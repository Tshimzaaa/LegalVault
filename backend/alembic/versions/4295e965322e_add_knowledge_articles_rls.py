"""add_knowledge_articles_rls

Adds row-level security to knowledge_articles, following the exact
tenant_isolation policy pattern from d4b2e6f18a3c_add_row_level_security.py.
Direct firm_id column — no child tables.

Revision ID: 4295e965322e
Revises: 037460c51f01
Create Date: 2026-08-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '4295e965322e'
down_revision: Union[str, Sequence[str], None] = '037460c51f01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLE = "knowledge_articles"
_CURRENT_FIRM_ID = "NULLIF(current_setting('app.current_firm_id', true), '')::uuid"
_IS_OWNER = "current_setting('app.is_owner', true) = 'true'"


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(f"ALTER TABLE {_TABLE} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {_TABLE} FORCE ROW LEVEL SECURITY")
    op.execute(
        f"""
        CREATE POLICY tenant_isolation ON {_TABLE}
        USING ({_IS_OWNER} OR firm_id = {_CURRENT_FIRM_ID})
        WITH CHECK ({_IS_OWNER} OR firm_id = {_CURRENT_FIRM_ID})
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {_TABLE}")
    op.execute(f"ALTER TABLE {_TABLE} NO FORCE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {_TABLE} DISABLE ROW LEVEL SECURITY")
