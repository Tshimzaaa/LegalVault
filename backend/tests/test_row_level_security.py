"""
Proves the RLS policies themselves are doing something — not just that the
application-level firm_id filtering happens to agree with them. These bypass
the service/repository layer entirely and query the ORM models directly
under different session-level tenant contexts.
"""
import pytest
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError

from app.database.rls import set_tenant_context
from app.modules.clients.models import Client
from app.modules.matters.models import Matter


def test_rls_blocks_cross_firm_select_on_matters(db_session, two_firms):
    set_tenant_context(db_session, firm_id=two_firms.firm_a.id)

    visible_ids = {m.id for m in db_session.scalars(select(Matter)).all()}
    assert two_firms.matter_a.id in visible_ids
    assert two_firms.matter_b.id not in visible_ids


def test_rls_blocks_cross_firm_select_on_clients(db_session, two_firms):
    set_tenant_context(db_session, firm_id=two_firms.firm_b.id)

    visible_ids = {c.id for c in db_session.scalars(select(Client)).all()}
    assert two_firms.client_b.id in visible_ids
    assert two_firms.client_a.id not in visible_ids


def test_rls_owner_bypass_sees_every_firm(db_session, two_firms):
    set_tenant_context(db_session, firm_id=None, is_owner=True)

    visible_ids = {m.id for m in db_session.scalars(select(Matter)).all()}
    assert two_firms.matter_a.id in visible_ids
    assert two_firms.matter_b.id in visible_ids


def test_rls_fails_closed_with_no_context_set(db_session, two_firms):
    # A connection that never sets either GUC (e.g. a stray script) must see
    # nothing on an RLS-protected table — fail closed, not open.
    set_tenant_context(db_session, firm_id=None, is_owner=False)

    assert db_session.scalars(select(Matter)).all() == []


def test_rls_blocks_insert_into_another_firms_scope(db_session, two_firms):
    set_tenant_context(db_session, firm_id=two_firms.firm_a.id)

    rogue_matter = Matter(
        firm_id=two_firms.firm_b.id,  # writing into firm B's scope while scoped as firm A
        client_id=two_firms.client_b.id,
        title="Should be rejected by the WITH CHECK clause",
    )
    db_session.add(rogue_matter)

    with pytest.raises(DBAPIError):
        db_session.flush()
