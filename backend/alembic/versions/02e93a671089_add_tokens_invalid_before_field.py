"""add tokens invalid before field

Revision ID: 02e93a671089
Revises: 2b7fd366b335
Create Date: 2026-07-23 14:26:01.635765

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '02e93a671089'
down_revision: Union[str, Sequence[str], None] = '2b7fd366b335'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('tokens_invalid_before', sa.DateTime(timezone=True), nullable=True))
    op.add_column('client_contacts', sa.Column('tokens_invalid_before', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('client_contacts', 'tokens_invalid_before')
    op.drop_column('users', 'tokens_invalid_before')
