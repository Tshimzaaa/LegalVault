"""add staff weekly capacity

Revision ID: c1d2e3f4a5b6
Revises: bb57b326ebe5
Create Date: 2026-09-15 00:00:00.000000

Backs the Resource Planning utilization view on Reporting — a nullable
self-reported weekly-hours capacity per staff member, set by an admin.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, Sequence[str], None] = 'bb57b326ebe5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('weekly_capacity_hours', sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'weekly_capacity_hours')
