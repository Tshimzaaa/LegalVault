"""allow client uploads on matter documents

Revision ID: 414433b30918
Revises: 13acd7271cd5
Create Date: 2026-07-31 13:51:38.512658

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '414433b30918'
down_revision: Union[str, Sequence[str], None] = '13acd7271cd5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('matter_documents', 'uploaded_by', nullable=True)
    op.add_column('matter_documents', sa.Column('uploaded_by_contact_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_matter_documents_uploaded_by_contact_id_client_contacts',
        'matter_documents', 'client_contacts',
        ['uploaded_by_contact_id'], ['id']
    )


def downgrade() -> None:
    op.drop_constraint('fk_matter_documents_uploaded_by_contact_id_client_contacts', 'matter_documents', type_='foreignkey')
    op.drop_column('matter_documents', 'uploaded_by_contact_id')
    op.alter_column('matter_documents', 'uploaded_by', nullable=False)
