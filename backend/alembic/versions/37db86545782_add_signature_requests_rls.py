"""add_signature_requests_rls

Adds row-level security to signature_requests and signature_recipients, following
the exact tenant_isolation policy pattern from d4b2e6f18a3c_add_row_level_security.py.
signature_requests has a direct firm_id column; signature_recipients is scoped via
its parent FK (same shape as intake_form_fields in 2c6187c448a9_add_intake_rls.py).

Revision ID: 37db86545782
Revises: 86d45629cb53
Create Date: 2026-08-15 22:29:46.134788

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '37db86545782'
down_revision: Union[str, Sequence[str], None] = '86d45629cb53'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_DIRECT_TABLE = "signature_requests"
_INDIRECT_TABLE = ("signature_recipients", "signature_request_id", "signature_requests")

_CURRENT_FIRM_ID = "NULLIF(current_setting('app.current_firm_id', true), '')::uuid"
_IS_OWNER = "current_setting('app.is_owner', true) = 'true'"


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(f"ALTER TABLE {_DIRECT_TABLE} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {_DIRECT_TABLE} FORCE ROW LEVEL SECURITY")
    op.execute(
        f"""
        CREATE POLICY tenant_isolation ON {_DIRECT_TABLE}
        USING ({_IS_OWNER} OR firm_id = {_CURRENT_FIRM_ID})
        WITH CHECK ({_IS_OWNER} OR firm_id = {_CURRENT_FIRM_ID})
        """
    )

    table, fk_column, parent_table = _INDIRECT_TABLE
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
    table, _fk_column, _parent_table = _INDIRECT_TABLE
    op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
    op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {_DIRECT_TABLE}")
    op.execute(f"ALTER TABLE {_DIRECT_TABLE} NO FORCE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {_DIRECT_TABLE} DISABLE ROW LEVEL SECURITY")
