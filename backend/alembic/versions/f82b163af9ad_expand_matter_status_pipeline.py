"""expand matter status pipeline

Revision ID: f82b163af9ad
Revises: 02e93a671089
Create Date: 2026-07-26 20:23:14.466974

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f82b163af9ad'
down_revision: Union[str, Sequence[str], None] = '02e93a671089'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE matterstatus ADD VALUE IF NOT EXISTS 'IN_REVIEW'")
    op.execute("ALTER TYPE matterstatus ADD VALUE IF NOT EXISTS 'AWAITING_SIGNATURE'")
    op.execute("ALTER TYPE matterstatus ADD VALUE IF NOT EXISTS 'SIGNED'")
    op.execute("ALTER TYPE matterstatus ADD VALUE IF NOT EXISTS 'DECLINED'")


def downgrade() -> None:
    # Postgres doesn't support removing enum values directly.
    # A real downgrade would require creating a new type, migrating data, dropping the old type.
    # Left as a no-op since removing values safely requires manual intervention.
    pass