"""add template body

Adds an optional `body` column to templates — HTML/text with {{placeholder}} markers,
substituted with intake-submission answers at document-generation time (see
app/modules/templates/render.py and MatterService.generate_document_from_template).
Purely additive metadata, edited in place via the existing PATCH /templates/{id} flow —
does not interact with the template's binary-file versioning at all.

Revision ID: 3017f4278009
Revises: 2d9a14027e1f
Create Date: 2026-08-25 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '3017f4278009'
down_revision: Union[str, Sequence[str], None] = '2d9a14027e1f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('templates', sa.Column('body', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('templates', 'body')
