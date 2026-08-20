"""add matter contact permissions

Adds matter_contact_permissions, giving firm staff a way to grant individual
client contacts an Owner/Editor/Viewer access level on a specific matter — the
real backing for the client-portal "Matter Admin" page, which previously showed
hardcoded rows. RLS follows the same indirect-via-parent-FK pattern as
signature_recipients in 37db86545782_add_signature_requests_rls.py, since this
table has no firm_id of its own (scoped through matters.firm_id).

Revision ID: 5a1e9f3c7b2d
Revises: 37db86545782
Create Date: 2026-08-20 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '5a1e9f3c7b2d'
down_revision: Union[str, Sequence[str], None] = '37db86545782'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLE = "matter_contact_permissions"
_CURRENT_FIRM_ID = "NULLIF(current_setting('app.current_firm_id', true), '')::uuid"
_IS_OWNER = "current_setting('app.is_owner', true) = 'true'"


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        _TABLE,
        sa.Column('matter_id', sa.UUID(), nullable=False),
        sa.Column('client_contact_id', sa.UUID(), nullable=False),
        sa.Column('permission_level', sa.Enum('OWNER', 'EDITOR', 'VIEWER', name='contactpermissionlevel'), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['matter_id'], ['matters.id'], name=op.f('fk_matter_contact_permissions_matter_id_matters')),
        sa.ForeignKeyConstraint(
            ['client_contact_id'], ['client_contacts.id'], name=op.f('fk_matter_contact_permissions_client_contact_id_client_contacts')
        ),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_matter_contact_permissions')),
        sa.UniqueConstraint('matter_id', 'client_contact_id', name=op.f('uq_matter_contact_permissions_matter_id')),
    )
    op.create_index(
        op.f('ix_matter_contact_permissions_matter_id'), _TABLE, ['matter_id'], unique=False
    )
    op.create_index(
        op.f('ix_matter_contact_permissions_client_contact_id'), _TABLE, ['client_contact_id'], unique=False
    )

    op.execute(f"ALTER TABLE {_TABLE} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {_TABLE} FORCE ROW LEVEL SECURITY")
    exists_clause = f"""
        EXISTS (
            SELECT 1 FROM matters
            WHERE matters.id = {_TABLE}.matter_id
            AND matters.firm_id = {_CURRENT_FIRM_ID}
        )
    """
    op.execute(
        f"""
        CREATE POLICY tenant_isolation ON {_TABLE}
        USING ({_IS_OWNER} OR {exists_clause})
        WITH CHECK ({_IS_OWNER} OR {exists_clause})
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {_TABLE}")
    op.execute(f"ALTER TABLE {_TABLE} NO FORCE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {_TABLE} DISABLE ROW LEVEL SECURITY")
    op.drop_index(op.f('ix_matter_contact_permissions_client_contact_id'), table_name=_TABLE)
    op.drop_index(op.f('ix_matter_contact_permissions_matter_id'), table_name=_TABLE)
    op.drop_table(_TABLE)
    sa.Enum(name='contactpermissionlevel').drop(op.get_bind(), checkfirst=True)
