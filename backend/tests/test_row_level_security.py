"""
Proves the RLS policies themselves are doing something — not just that the
application-level org_id filtering happens to agree with them. These bypass
the service/repository layer entirely and query the ORM models directly
under different session-level tenant contexts.
"""
import pytest
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError

from app.database.rls import set_tenant_context
from app.modules.matters.models import ApprovalStatus, Matter, MatterApproval, MatterStatus


def test_rls_blocks_cross_org_select_on_matters(db_session, two_orgs):
    set_tenant_context(db_session, org_id=two_orgs.org_a.id)

    visible_ids = {m.id for m in db_session.scalars(select(Matter)).all()}
    assert two_orgs.matter_a.id in visible_ids
    assert two_orgs.matter_b.id not in visible_ids


def test_rls_owner_bypass_sees_every_org(db_session, two_orgs):
    set_tenant_context(db_session, org_id=None, is_owner=True)

    visible_ids = {m.id for m in db_session.scalars(select(Matter)).all()}
    assert two_orgs.matter_a.id in visible_ids
    assert two_orgs.matter_b.id in visible_ids


def test_rls_fails_closed_with_no_context_set(db_session, two_orgs):
    # A connection that never sets either GUC (e.g. a stray script) must see
    # nothing on an RLS-protected table — fail closed, not open.
    set_tenant_context(db_session, org_id=None, is_owner=False)

    assert db_session.scalars(select(Matter)).all() == []


def test_rls_blocks_insert_into_another_orgs_scope(db_session, two_orgs):
    set_tenant_context(db_session, org_id=two_orgs.org_a.id)

    rogue_matter = Matter(
        org_id=two_orgs.org_b.id,  # writing into org B's scope while scoped as org A
        title="Should be rejected by the WITH CHECK clause",
    )
    db_session.add(rogue_matter)

    with pytest.raises(DBAPIError):
        db_session.flush()


def test_rls_blocks_cross_org_select_on_matter_approvals(db_session, two_orgs):
    # matter_approvals has no org_id of its own — scoped indirectly via matter_id ->
    # matters.org_id (see migration 2d9a14027e1f). Mirrors the direct-Matter/Client
    # checks above for the one table added since those were written.
    approval_a = MatterApproval(
        matter_id=two_orgs.matter_a.id,
        requested_by=two_orgs.staff_a.id,
        from_status=MatterStatus.AWAITING_SIGNATURE,
        to_status=MatterStatus.SIGNED,
        status=ApprovalStatus.PENDING,
    )
    approval_b = MatterApproval(
        matter_id=two_orgs.matter_b.id,
        requested_by=two_orgs.staff_b.id,
        from_status=MatterStatus.AWAITING_SIGNATURE,
        to_status=MatterStatus.SIGNED,
        status=ApprovalStatus.PENDING,
    )
    db_session.add_all([approval_a, approval_b])
    db_session.flush()

    set_tenant_context(db_session, org_id=two_orgs.org_a.id)

    visible_ids = {a.id for a in db_session.scalars(select(MatterApproval)).all()}
    assert approval_a.id in visible_ids
    assert approval_b.id not in visible_ids
