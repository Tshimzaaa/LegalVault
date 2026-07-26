"""migrate in_progress matters to in_review

Revision ID: a62607c2daa3
Revises: f82b163af9ad
Create Date: 2026-07-26 20:25:17.884329

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a62607c2daa3'
down_revision: Union[str, Sequence[str], None] = 'f82b163af9ad'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE matters SET status = 'IN_REVIEW' WHERE status = 'IN_PROGRESS'")

def downgrade() -> None:
    op.execute("UPDATE matters SET status = 'IN_PROGRESS' WHERE status = 'IN_REVIEW'")