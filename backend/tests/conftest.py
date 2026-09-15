"""
Shared pytest fixtures.

Tests run against a real Postgres database (TEST_DATABASE_URL, falling back to
the same DATABASE_URL the app uses locally) but never persist anything: each
test gets its own SQLAlchemy Session bound to a connection with
join_transaction_mode="create_savepoint", so the `self.db.commit()` calls
scattered through the service layer issue a SAVEPOINT instead of ending the
real transaction. The whole thing is rolled back when the test ends, so
running against a shared dev database is safe — nothing written by a test is
ever actually committed.
"""
import os
import uuid
from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session as SQLAlchemySession

from app.main import app
from app.database.session import get_db
from app.database.rls import set_tenant_context
from app.core.limiter import limiter
from app.core.security import hash_password, create_access_token
from app.core.config import settings
from app.modules.auth.models import Organization, User
from app.modules.auth.models.role import UserRole
from app.modules.contracts.models import Contract, ContractAssignment, ContractRole, ContractStage
from app.modules.signed_contracts.models import ContractStatus, ContractType, SignedContract

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    settings.RUNTIME_DATABASE_URL or settings.DATABASE_URL,
)
DEFAULT_PASSWORD = "TestPassword123!"

_engine = create_engine(TEST_DATABASE_URL)


@pytest.fixture()
def db_session():
    connection = _engine.connect()
    outer_tx = connection.begin()
    session = SQLAlchemySession(bind=connection, join_transaction_mode="create_savepoint")
    # Factories below insert rows for arbitrary orgs directly (bypassing the app's
    # normal auth-dependency flow that would otherwise set this), so start every test
    # in RLS "owner mode" — an actual HTTP request through the `client` fixture
    # re-sets this to the real actor's org before its own queries run.
    set_tenant_context(session, org_id=None, is_owner=True)
    try:
        yield session
    finally:
        session.close()
        outer_tx.rollback()
        connection.close()


@pytest.fixture(autouse=True)
def _reset_rate_limiter():
    # Login/register are IP-rate-limited (see core/limiter.py); tests share one
    # client IP, so without this every test after the first few would 429.
    limiter.reset()
    yield


@pytest.fixture()
def client(db_session):
    def _get_db_override():
        yield db_session

    app.dependency_overrides[get_db] = _get_db_override
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


# ---- factories --------------------------------------------------------
# Plain helper functions (not fixtures) so tests can create as many orgs/
# users/contracts as a given scenario needs, with sensible defaults for
# everything a test doesn't care about.


def make_org(db_session, **overrides) -> Organization:
    org = Organization(
        name=overrides.get("name", f"Test Org {uuid.uuid4().hex[:8]}"),
        email=overrides.get("email", f"org-{uuid.uuid4().hex[:8]}@example.com"),
        is_active=overrides.get("is_active", True),
    )
    db_session.add(org)
    db_session.flush()
    return org


def make_staff(db_session, org: Organization, *, role: UserRole = UserRole.ADMIN, password: str = DEFAULT_PASSWORD, **overrides) -> tuple[User, str]:
    user = User(
        org_id=org.id,
        first_name=overrides.get("first_name", "Test"),
        last_name=overrides.get("last_name", "Staffer"),
        email=overrides.get("email", f"staff-{uuid.uuid4().hex[:8]}@example.com"),
        password_hash=hash_password(password),
        role=role,
        is_active=overrides.get("is_active", True),
    )
    db_session.add(user)
    db_session.flush()
    return user, password


def make_contract(db_session, org: Organization, **overrides) -> Contract:
    contract = Contract(
        org_id=org.id,
        title=overrides.get("title", "Test Contract"),
        description=overrides.get("description"),
        due_date=overrides.get("due_date"),
        status=overrides.get("status", ContractStage.INTAKE),
    )
    db_session.add(contract)
    db_session.flush()
    return contract


def make_contract_assignment(db_session, contract: Contract, user: User, *, role_on_contract: ContractRole = ContractRole.LEAD_LAWYER) -> ContractAssignment:
    assignment = ContractAssignment(
        contract_id=contract.id,
        user_id=user.id,
        role_on_contract=role_on_contract,
    )
    db_session.add(assignment)
    db_session.flush()
    return assignment


def make_signed_contract(db_session, org: Organization, **overrides) -> SignedContract:
    contract = SignedContract(
        org_id=org.id,
        contract_id=overrides.get("contract_id"),
        uploaded_by=overrides.get("uploaded_by"),
        title=overrides.get("title", "Test Contract"),
        description=overrides.get("description"),
        agreement_type=overrides.get("agreement_type", ContractType.GENERAL),
        signed_date=overrides.get("signed_date", date.today()),
        expiry_date=overrides.get("expiry_date"),
        integration_source=overrides.get("integration_source", "manual"),
        status=overrides.get("status", ContractStatus.ACTIVE),
        file_key=overrides.get("file_key", f"contracts/{uuid.uuid4().hex}.pdf"),
        original_filename=overrides.get("original_filename", "contract.pdf"),
        content_type=overrides.get("content_type", "application/pdf"),
    )
    db_session.add(contract)
    db_session.flush()
    return contract


def owner_headers() -> dict:
    """The owner console has no DB-backed identity — the token's "owner" type
    claim alone is what get_current_owner checks (see owner/dependencies.py)."""
    token = create_access_token(subject="owner", extra_claims={"type": "owner"})
    return {"Authorization": f"Bearer {token}"}


def auth_headers(actor) -> dict:
    """actor is a User (staff)."""
    token = create_access_token(subject=str(actor.id))
    return {"Authorization": f"Bearer {token}"}


class TwoOrgs:
    """Two fully-populated orgs (own admin, contract each) for isolation tests."""

    def __init__(self, db_session):
        self.org_a = make_org(db_session)
        self.staff_a, self.staff_a_password = make_staff(db_session, self.org_a)
        self.contract_a = make_contract(db_session, self.org_a)

        self.org_b = make_org(db_session)
        self.staff_b, self.staff_b_password = make_staff(db_session, self.org_b)
        self.contract_b = make_contract(db_session, self.org_b)


@pytest.fixture()
def two_orgs(db_session) -> TwoOrgs:
    return TwoOrgs(db_session)
