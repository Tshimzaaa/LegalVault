"""add inquiries table

Revision ID: c7d8e9f0a1b2
Revises: b6c7d8e9f0a1
Create Date: 2026-09-20 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c7d8e9f0a1b2'
down_revision: Union[str, Sequence[str], None] = 'b6c7d8e9f0a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('inquiries',
    sa.Column('kind', sa.Enum('CONTACT', 'ACCESS_REQUEST', name='inquirykind'), nullable=False),
    sa.Column('status', sa.Enum('NEW', 'IN_PROGRESS', 'ONBOARDED', 'CLOSED', name='inquirystatus'), nullable=False),
    sa.Column('name', sa.String(length=150), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=False),
    sa.Column('phone', sa.String(length=30), nullable=True),
    sa.Column('organization_name', sa.String(length=150), nullable=True),
    sa.Column('message', sa.Text(), nullable=True),
    sa.Column('owner_note', sa.Text(), nullable=True),
    sa.Column('handled_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('organization_id', sa.UUID(), nullable=True),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_inquiries'))
    )


def downgrade() -> None:
    op.drop_table('inquiries')
    sa.Enum(name='inquirystatus').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='inquirykind').drop(op.get_bind(), checkfirst=True)
