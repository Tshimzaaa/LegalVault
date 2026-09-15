"""add_intake_rls

Adds row-level security to intake_forms, intake_form_fields, intake_submissions,
and intake_submission_answers. The two direct tables (org_id column) get the
tenant_isolation policy directly; the two indirect tables key off their parent's
org_id via a subquery, following the pattern used for tables like matter_documents
in the base add_row_level_security migration.

Revision ID: a5b6c7d8e9f0
Revises: f4a5b6c7d8e9
Create Date: 2026-09-15 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a5b6c7d8e9f0'
down_revision: Union[str, Sequence[str], None] = 'f4a5b6c7d8e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_DIRECT_TABLES = ("intake_forms", "intake_submissions")
_CURRENT_ORG_ID = "NULLIF(current_setting('app.current_org_id', true), '')::uuid"
_IS_OWNER = "current_setting('app.is_owner', true) = 'true'"


def upgrade() -> None:
    """Upgrade schema."""
    for table in _DIRECT_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"""
            CREATE POLICY tenant_isolation ON {table}
            USING ({_IS_OWNER} OR org_id = {_CURRENT_ORG_ID})
            WITH CHECK ({_IS_OWNER} OR org_id = {_CURRENT_ORG_ID})
            """
        )

    # Indirect tables (no org_id of their own) key off the parent's org_id via EXISTS,
    # matching the established pattern for e.g. matter_documents/matter_tasks (see
    # _RLS_INDIRECT_TABLES in 7be238228b8e_rename_law_firm_tenant_to_organization.py).
    for table, fk_column, parent_table in (
        ("intake_form_fields", "form_id", "intake_forms"),
        ("intake_submission_answers", "submission_id", "intake_submissions"),
    ):
        exists_clause = f"""
            EXISTS (
                SELECT 1 FROM {parent_table}
                WHERE {parent_table}.id = {table}.{fk_column}
                AND {parent_table}.org_id = {_CURRENT_ORG_ID}
            )
        """
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(
            f"""
            CREATE POLICY tenant_isolation ON {table}
            USING ({_IS_OWNER} OR {exists_clause})
            WITH CHECK ({_IS_OWNER} OR {exists_clause})
            """
        )


def downgrade() -> None:
    """Downgrade schema."""
    for table in ("intake_submission_answers", "intake_form_fields", *_DIRECT_TABLES):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
