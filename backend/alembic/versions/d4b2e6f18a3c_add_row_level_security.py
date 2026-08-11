"""add row-level security as defense-in-depth on tenant-data tables

This is additive, not a replacement, for the application-level firm_id
filtering already present in every repository (see backend/docs/architecture.md).
If a future query ever forgets a `WHERE firm_id = ...`, these policies are
the safety net that stops it from leaking another firm's data — the app
should never actually need to rely on the two disagreeing.

`users`, `law_firms`, and `client_contacts` are deliberately NOT covered:
staff login has to look up a user by email, and client-portal login/accept-
invite/forgot-password/reset-password all have to look up a contact by email
or a bare token, with no firm context yet in every case (see
app.modules.auth.services.login and app.modules.clients.service's
login/accept_invite/request_password_reset/reset_password) — so those three
stay app-level-enforced only, same as today. (Contact access from an
*authenticated* staff session — list/invite/deactivate/delete — is already
firm-scoped at the application layer and unaffected by this migration.)

Session context comes from two Postgres GUCs, set per-request via
`app.database.rls.set_tenant_context()`:
  - app.current_firm_id — the UUID of the authenticated staff/client's firm
  - app.is_owner        — 'true' for the SaaS-owner console, which is
                           intentionally cross-firm

IMPORTANT for future migrations: any migration that needs to INSERT/UPDATE
rows in one of the tables below must either run as a role with BYPASSRLS, or
`SET app.is_owner = 'true'` at the top of the migration — a connection with
neither GUC set will see (and therefore update) zero rows on these tables,
since FORCE ROW LEVEL SECURITY makes the policy apply even to the table
owner.

Revision ID: d4b2e6f18a3c
Revises: c3a1f9e2b7d4
Create Date: 2026-08-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'd4b2e6f18a3c'
down_revision: Union[str, Sequence[str], None] = 'c3a1f9e2b7d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Tables with a direct firm_id column.
_DIRECT_TABLES = ["clients", "matters", "templates", "signed_contracts", "support_requests", "audit_logs"]

# Tables scoped only via a parent FK — (table, fk_column, parent_table) triples.
# client_contacts is deliberately excluded — see the module docstring.
_INDIRECT_TABLES = [
    ("matter_assignments", "matter_id", "matters"),
    ("matter_documents", "matter_id", "matters"),
    ("matter_tasks", "matter_id", "matters"),
    ("matter_messages", "matter_id", "matters"),
]

_CURRENT_FIRM_ID = "NULLIF(current_setting('app.current_firm_id', true), '')::uuid"
_IS_OWNER = "current_setting('app.is_owner', true) = 'true'"


def upgrade() -> None:
    """Upgrade schema."""
    # These three were missing entirely — the policies below filter on firm_id,
    # so without an index each check is a sequential scan.
    op.create_index(op.f('ix_signed_contracts_firm_id'), 'signed_contracts', ['firm_id'])
    op.create_index(op.f('ix_support_requests_firm_id'), 'support_requests', ['firm_id'])
    op.create_index(op.f('ix_templates_firm_id'), 'templates', ['firm_id'])

    for table in _DIRECT_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"""
            CREATE POLICY tenant_isolation ON {table}
            USING ({_IS_OWNER} OR firm_id = {_CURRENT_FIRM_ID})
            WITH CHECK ({_IS_OWNER} OR firm_id = {_CURRENT_FIRM_ID})
            """
        )

    for table, fk_column, parent_table in _INDIRECT_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        exists_clause = f"""
            EXISTS (
                SELECT 1 FROM {parent_table}
                WHERE {parent_table}.id = {table}.{fk_column}
                AND {parent_table}.firm_id = {_CURRENT_FIRM_ID}
            )
        """
        op.execute(
            f"""
            CREATE POLICY tenant_isolation ON {table}
            USING ({_IS_OWNER} OR {exists_clause})
            WITH CHECK ({_IS_OWNER} OR {exists_clause})
            """
        )


def downgrade() -> None:
    """Downgrade schema."""
    for table, _fk_column, _parent_table in reversed(_INDIRECT_TABLES):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    for table in reversed(_DIRECT_TABLES):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    op.drop_index(op.f('ix_templates_firm_id'), table_name='templates')
    op.drop_index(op.f('ix_support_requests_firm_id'), table_name='support_requests')
    op.drop_index(op.f('ix_signed_contracts_firm_id'), table_name='signed_contracts')
