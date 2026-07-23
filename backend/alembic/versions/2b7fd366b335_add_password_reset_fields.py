"""add password reset fields

Revision ID: 2b7fd366b335
Revises: 22348e0468e2
Create Date: 2026-07-21 12:19:43.793732

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2b7fd366b335'
down_revision: Union[str, Sequence[str], None] = '22348e0468e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('reset_token', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('reset_token_expires_at', sa.DateTime(timezone=True), nullable=True))
    op.create_unique_constraint('uq_users_reset_token', 'users', ['reset_token'])

    op.add_column('client_contacts', sa.Column('reset_token', sa.String(255), nullable=True))
    op.add_column('client_contacts', sa.Column('reset_token_expires_at', sa.DateTime(timezone=True), nullable=True))
    op.create_unique_constraint('uq_client_contacts_reset_token', 'client_contacts', ['reset_token'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('uq_client_contacts_reset_token', 'client_contacts', type_='unique')
    op.drop_column('client_contacts', 'reset_token_expires_at')
    op.drop_column('client_contacts', 'reset_token')

    op.drop_constraint('uq_users_reset_token', 'users', type_='unique')
    op.drop_column('users', 'reset_token_expires_at')
    op.drop_column('users', 'reset_token')