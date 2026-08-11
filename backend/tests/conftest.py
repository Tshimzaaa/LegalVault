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
from app.modules.auth.models import LawFirm, User
from app.modules.auth.models.role import UserRole
from app.modules.clients.models import Client, ClientContact
from app.modules.matters.models import Matter

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
    # Factories below insert rows for arbitrary firms directly (bypassing the app's
    # normal auth-dependency flow that would otherwise set this), so start every test
    # in RLS "owner mode" — an actual HTTP request through the `client` fixture
    # re-sets this to the real actor's firm before its own queries run.
    set_tenant_context(session, firm_id=None, is_owner=True)
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
# Plain helper functions (not fixtures) so tests can create as many firms/
# users/matters as a given scenario needs, with sensible defaults for
# everything a test doesn't care about.


def make_firm(db_session, **overrides) -> LawFirm:
    firm = LawFirm(
        name=overrides.get("name", f"Test Firm {uuid.uuid4().hex[:8]}"),
        email=overrides.get("email", f"firm-{uuid.uuid4().hex[:8]}@example.com"),
        is_active=overrides.get("is_active", True),
    )
    db_session.add(firm)
    db_session.flush()
    return firm


def make_staff(db_session, firm: LawFirm, *, role: UserRole = UserRole.ADMIN, password: str = DEFAULT_PASSWORD, **overrides) -> tuple[User, str]:
    user = User(
        firm_id=firm.id,
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


def make_client_company(db_session, firm: LawFirm, **overrides) -> Client:
    client_company = Client(
        firm_id=firm.id,
        company_name=overrides.get("company_name", f"Test Client {uuid.uuid4().hex[:8]}"),
        is_active=overrides.get("is_active", True),
    )
    db_session.add(client_company)
    db_session.flush()
    return client_company


def make_contact(db_session, client_company: Client, *, password: str = DEFAULT_PASSWORD, **overrides) -> tuple[ClientContact, str]:
    contact = ClientContact(
        client_id=client_company.id,
        first_name=overrides.get("first_name", "Test"),
        last_name=overrides.get("last_name", "Contact"),
        email=overrides.get("email", f"contact-{uuid.uuid4().hex[:8]}@example.com"),
        password_hash=hash_password(password),
        is_active=overrides.get("is_active", True),
        invitation_status="accepted",
    )
    db_session.add(contact)
    db_session.flush()
    return contact, password


def make_matter(db_session, firm: LawFirm, client_company: Client, **overrides) -> Matter:
    matter = Matter(
        firm_id=firm.id,
        client_id=client_company.id,
        title=overrides.get("title", "Test Matter"),
        description=overrides.get("description"),
        is_visible_to_client=overrides.get("is_visible_to_client", False),
    )
    db_session.add(matter)
    db_session.flush()
    return matter


def owner_headers() -> dict:
    """The owner console has no DB-backed identity — the token's "owner" type
    claim alone is what get_current_owner checks (see owner/dependencies.py)."""
    token = create_access_token(subject="owner", extra_claims={"type": "owner"})
    return {"Authorization": f"Bearer {token}"}


def auth_headers(actor) -> dict:
    """actor is a User (staff) or a ClientContact (client portal) — mirrors the
    extra_claims each login flow actually puts on the token (see
    clients/service.py's login/refresh_token), since get_current_contact
    requires payload["type"] == "client" to accept a token at all."""
    if isinstance(actor, ClientContact):
        token = create_access_token(
            subject=str(actor.id),
            extra_claims={"type": "client", "client_id": str(actor.client_id)},
        )
    else:
        token = create_access_token(subject=str(actor.id))
    return {"Authorization": f"Bearer {token}"}


class TwoFirms:
    """Two fully-populated firms (own admin, client, matter each) for isolation tests."""

    def __init__(self, db_session):
        self.firm_a = make_firm(db_session)
        self.staff_a, self.staff_a_password = make_staff(db_session, self.firm_a)
        self.client_a = make_client_company(db_session, self.firm_a)
        self.matter_a = make_matter(db_session, self.firm_a, self.client_a)

        self.firm_b = make_firm(db_session)
        self.staff_b, self.staff_b_password = make_staff(db_session, self.firm_b)
        self.client_b = make_client_company(db_session, self.firm_b)
        self.matter_b = make_matter(db_session, self.firm_b, self.client_b)


@pytest.fixture()
def two_firms(db_session) -> TwoFirms:
    return TwoFirms(db_session)
