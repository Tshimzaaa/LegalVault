"""add_ai_assistant_rls

Adds row-level security to ai_conversations and ai_messages, using
app.current_org_id directly (these tables post-date the firm->org GUC
rename, so — unlike fallback_clauses' original RLS migration — there's no
legacy app.current_firm_id reference to worry about here).

Revision ID: e3f4a5b6c7d8
Revises: d2e3f4a5b6c7
Create Date: 2026-09-15 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'e3f4a5b6c7d8'
down_revision: Union[str, Sequence[str], None] = 'd2e3f4a5b6c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLES = ("ai_conversations", "ai_messages")
_CURRENT_ORG_ID = "NULLIF(current_setting('app.current_org_id', true), '')::uuid"
_IS_OWNER = "current_setting('app.is_owner', true) = 'true'"


def upgrade() -> None:
    """Upgrade schema."""
    for table in _TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"""
            CREATE POLICY tenant_isolation ON {table}
            USING ({_IS_OWNER} OR org_id = {_CURRENT_ORG_ID})
            WITH CHECK ({_IS_OWNER} OR org_id = {_CURRENT_ORG_ID})
            """
        )


def downgrade() -> None:
    """Downgrade schema."""
    for table in _TABLES:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
