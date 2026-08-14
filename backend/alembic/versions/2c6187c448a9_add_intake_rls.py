"""add_intake_rls

Adds row-level security to the intake_* tables, following the exact
tenant_isolation policy pattern from d4b2e6f18a3c_add_row_level_security.py.
intake_forms/intake_submissions have a direct firm_id column; intake_form_fields/
intake_submission_answers are scoped via their parent FK.

Revision ID: 2c6187c448a9
Revises: c70ad5778c25
Create Date: 2026-08-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '2c6187c448a9'
down_revision: Union[str, Sequence[str], None] = 'c70ad5778c25'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_DIRECT_TABLES = ["intake_forms", "intake_submissions"]

_INDIRECT_TABLES = [
    ("intake_form_fields", "form_id", "intake_forms"),
    ("intake_submission_answers", "submission_id", "intake_submissions"),
]

_CURRENT_FIRM_ID = "NULLIF(current_setting('app.current_firm_id', true), '')::uuid"
_IS_OWNER = "current_setting('app.is_owner', true) = 'true'"


def upgrade() -> None:
    """Upgrade schema."""
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
