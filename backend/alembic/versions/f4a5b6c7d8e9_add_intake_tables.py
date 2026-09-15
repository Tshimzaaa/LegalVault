"""add intake tables

Revision ID: f4a5b6c7d8e9
Revises: e3f4a5b6c7d8
Create Date: 2026-09-15 00:00:00.000000

Intake form builder tables — a clean-room rebuild for the corporate/in-house
model (no client tier), so submissions are made by a User (submitted_by),
not an external client contact, and convert into a Contract.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f4a5b6c7d8e9'
down_revision: Union[str, Sequence[str], None] = 'e3f4a5b6c7d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # These enum types are leftovers from the pre-corporate-pivot intake module
    # (dropped in b5fc97d5dec6_drop_client_tier.py along with its tables, but Postgres
    # doesn't auto-drop a type just because its last using table was dropped) — same
    # values this rebuild needs, so reuse rather than fail on CREATE TYPE already-exists.
    field_type_enum = postgresql.ENUM(
        'TEXT', 'TEXTAREA', 'NUMBER', 'DATE', 'DROPDOWN', 'CHECKBOX', 'FILE',
        name='intakefieldtype', create_type=False,
    )
    submission_status_enum = postgresql.ENUM(
        'SUBMITTED', 'IN_REVIEW', 'RESOLVED', 'CONVERTED', 'DECLINED',
        name='intakesubmissionstatus', create_type=False,
    )

    op.create_table(
        'intake_forms',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_published', sa.Boolean(), nullable=False),
        sa.Column('is_system', sa.Boolean(), nullable=False),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_intake_forms_org_id'), 'intake_forms', ['org_id'], unique=False)

    op.create_table(
        'intake_form_fields',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('form_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('label', sa.String(length=200), nullable=False),
        sa.Column('key', sa.String(length=100), nullable=True),
        sa.Column('field_type', field_type_enum, nullable=False),
        sa.Column('is_required', sa.Boolean(), nullable=False),
        sa.Column('help_text', sa.String(length=500), nullable=True),
        sa.Column('options', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['form_id'], ['intake_forms.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_intake_form_fields_form_id'), 'intake_form_fields', ['form_id'], unique=False)
    op.create_index(
        'ix_intake_form_fields_form_id_key', 'intake_form_fields', ['form_id', 'key'],
        unique=True, postgresql_where=sa.text('key IS NOT NULL'),
    )

    op.create_table(
        'intake_submissions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('org_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('form_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('submitted_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('status', submission_status_enum, nullable=False),
        sa.Column('converted_contract_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.ForeignKeyConstraint(['org_id'], ['organizations.id']),
        sa.ForeignKeyConstraint(['form_id'], ['intake_forms.id']),
        sa.ForeignKeyConstraint(['submitted_by'], ['users.id']),
        sa.ForeignKeyConstraint(['converted_contract_id'], ['contracts.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_intake_submissions_org_id'), 'intake_submissions', ['org_id'], unique=False)
    op.create_index(op.f('ix_intake_submissions_form_id'), 'intake_submissions', ['form_id'], unique=False)
    op.create_index(op.f('ix_intake_submissions_submitted_by'), 'intake_submissions', ['submitted_by'], unique=False)
    op.create_index(op.f('ix_intake_submissions_status'), 'intake_submissions', ['status'], unique=False)

    op.create_table(
        'intake_submission_answers',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('submission_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('field_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('value', sa.Text(), nullable=True),
        sa.Column('file_key', sa.String(length=500), nullable=True),
        sa.Column('original_filename', sa.String(length=255), nullable=True),
        sa.Column('content_type', sa.String(length=100), nullable=True),
        sa.ForeignKeyConstraint(['submission_id'], ['intake_submissions.id']),
        sa.ForeignKeyConstraint(['field_id'], ['intake_form_fields.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_intake_submission_answers_submission_id'), 'intake_submission_answers', ['submission_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_intake_submission_answers_submission_id'), table_name='intake_submission_answers')
    op.drop_table('intake_submission_answers')
    op.drop_index(op.f('ix_intake_submissions_status'), table_name='intake_submissions')
    op.drop_index(op.f('ix_intake_submissions_submitted_by'), table_name='intake_submissions')
    op.drop_index(op.f('ix_intake_submissions_form_id'), table_name='intake_submissions')
    op.drop_index(op.f('ix_intake_submissions_org_id'), table_name='intake_submissions')
    op.drop_table('intake_submissions')
    op.drop_index('ix_intake_form_fields_form_id_key', table_name='intake_form_fields')
    op.drop_index(op.f('ix_intake_form_fields_form_id'), table_name='intake_form_fields')
    op.drop_table('intake_form_fields')
    op.drop_index(op.f('ix_intake_forms_org_id'), table_name='intake_forms')
    op.drop_table('intake_forms')
    # Enum types intentionally left in place — they pre-date this migration (see the
    # comment in upgrade()) and this migration didn't create them, so it shouldn't drop them.
