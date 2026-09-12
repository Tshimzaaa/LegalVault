"""add fallback clauses table

Revision ID: f1a2b3c4d5e6
Revises: 9e432203a31f
Create Date: 2026-09-11 00:00:00.000000

Firm-editable fallback clause library, backing the client portal's "My Learned
Friend" page (previously hardcoded mock content in the frontend).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, Sequence[str], None] = '9e432203a31f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'fallback_clauses',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('firm_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(length=200), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=False),
        sa.Column('description', sa.String(length=500), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('pre_approved', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['firm_id'], ['law_firms.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_fallback_clauses_firm_id'), 'fallback_clauses', ['firm_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_fallback_clauses_firm_id'), table_name='fallback_clauses')
    op.drop_table('fallback_clauses')
