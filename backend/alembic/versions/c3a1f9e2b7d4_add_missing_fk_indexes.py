"""add missing indexes on frequently filtered FK columns

Revision ID: c3a1f9e2b7d4
Revises: b1e993708ad7
Create Date: 2026-08-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'c3a1f9e2b7d4'
down_revision: Union[str, Sequence[str], None] = 'b1e993708ad7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_index(op.f('ix_matters_firm_id'), 'matters', ['firm_id'])
    op.create_index(op.f('ix_matters_client_id'), 'matters', ['client_id'])
    op.create_index(op.f('ix_clients_firm_id'), 'clients', ['firm_id'])
    op.create_index(op.f('ix_matter_assignments_matter_id'), 'matter_assignments', ['matter_id'])
    op.create_index(op.f('ix_matter_documents_matter_id'), 'matter_documents', ['matter_id'])
    op.create_index(op.f('ix_matter_tasks_matter_id'), 'matter_tasks', ['matter_id'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_matter_tasks_matter_id'), table_name='matter_tasks')
    op.drop_index(op.f('ix_matter_documents_matter_id'), table_name='matter_documents')
    op.drop_index(op.f('ix_matter_assignments_matter_id'), table_name='matter_assignments')
    op.drop_index(op.f('ix_clients_firm_id'), table_name='clients')
    op.drop_index(op.f('ix_matters_client_id'), table_name='matters')
    op.drop_index(op.f('ix_matters_firm_id'), table_name='matters')
