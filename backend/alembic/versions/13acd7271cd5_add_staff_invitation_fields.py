"""add staff invitation fields

Revision ID: 13acd7271cd5
Revises: 986f46fa7748
Create Date: 2026-07-27 11:01:51.398804

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '13acd7271cd5'
down_revision: Union[str, Sequence[str], None] = '986f46fa7748'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('invitation_status', sa.String(20), nullable=False, server_default='accepted'))
    op.add_column('users', sa.Column('invitation_token', sa.String(255), nullable=True))
    op.add_column('users', sa.Column('invitation_expires_at', sa.DateTime(timezone=True), nullable=True))
    op.create_unique_constraint('uq_users_invitation_token', 'users', ['invitation_token'])
    op.alter_column('users', 'password_hash', nullable=True)


def downgrade() -> None:
    op.alter_column('users', 'password_hash', nullable=False)
    op.drop_constraint('uq_users_invitation_token', 'users', type_='unique')
    op.drop_column('users', 'invitation_expires_at')
    op.drop_column('users', 'invitation_token')
    op.drop_column('users', 'invitation_status')