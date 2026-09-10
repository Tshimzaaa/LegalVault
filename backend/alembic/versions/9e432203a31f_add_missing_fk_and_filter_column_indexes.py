"""add missing fk and filter column indexes

Revision ID: 9e432203a31f
Revises: e5f6a7b8c9d0
Create Date: 2026-09-10 03:04:14.987032

Adds indexes on FK/filter columns that were missing them (found via a performance audit):
firm-tenancy FKs on users/signed_contracts/templates, several matter_* actor FKs, intake
submission client/contact/status, and audit log action/target columns.

Hand-trimmed from the raw `alembic revision --autogenerate` output, which also proposed
dropping the GIN full-text search indexes (a false positive — those are raw-SQL expression
indexes that autogenerate can't diff correctly against the ORM metadata) and renaming the
matter_approvals status enum / dropping its one-pending-per-matter partial unique index
(unrelated pre-existing drift, out of scope here and risky to fold in blind). Neither of
those belongs in an "add missing indexes" migration, so both were removed from upgrade()
and downgrade() before this file was committed.
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '9e432203a31f'
down_revision: Union[str, Sequence[str], None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(op.f('ix_audit_logs_action'), 'audit_logs', ['action'], unique=False)
    op.create_index(op.f('ix_audit_logs_target_id'), 'audit_logs', ['target_id'], unique=False)
    op.create_index(op.f('ix_audit_logs_target_type'), 'audit_logs', ['target_type'], unique=False)
    op.create_index(op.f('ix_client_contacts_client_id'), 'client_contacts', ['client_id'], unique=False)
    op.create_index(op.f('ix_firm_integrations_configured_by'), 'firm_integrations', ['configured_by'], unique=False)
    op.create_index(op.f('ix_intake_submissions_client_id'), 'intake_submissions', ['client_id'], unique=False)
    op.create_index(op.f('ix_intake_submissions_contact_id'), 'intake_submissions', ['contact_id'], unique=False)
    op.create_index(op.f('ix_intake_submissions_status'), 'intake_submissions', ['status'], unique=False)
    op.create_index(op.f('ix_knowledge_articles_created_by'), 'knowledge_articles', ['created_by'], unique=False)
    op.create_index(op.f('ix_matter_approvals_decided_by'), 'matter_approvals', ['decided_by'], unique=False)
    op.create_index(op.f('ix_matter_approvals_requested_by'), 'matter_approvals', ['requested_by'], unique=False)
    op.create_index(op.f('ix_matter_assignments_user_id'), 'matter_assignments', ['user_id'], unique=False)
    op.create_index(op.f('ix_matter_documents_uploaded_by'), 'matter_documents', ['uploaded_by'], unique=False)
    op.create_index(
        op.f('ix_matter_documents_uploaded_by_contact_id'), 'matter_documents', ['uploaded_by_contact_id'],
        unique=False,
    )
    op.create_index(op.f('ix_matter_tasks_assigned_to'), 'matter_tasks', ['assigned_to'], unique=False)
    op.create_index(op.f('ix_signature_recipients_recipient_id'), 'signature_recipients', ['recipient_id'], unique=False)
    op.create_index(op.f('ix_signed_contracts_client_id'), 'signed_contracts', ['client_id'], unique=False)
    op.create_index(op.f('ix_signed_contracts_matter_id'), 'signed_contracts', ['matter_id'], unique=False)
    op.create_index(op.f('ix_signed_contracts_status'), 'signed_contracts', ['status'], unique=False)
    op.create_index(op.f('ix_signed_contracts_uploaded_by'), 'signed_contracts', ['uploaded_by'], unique=False)
    op.create_index(op.f('ix_users_firm_id'), 'users', ['firm_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_users_firm_id'), table_name='users')
    op.drop_index(op.f('ix_signed_contracts_uploaded_by'), table_name='signed_contracts')
    op.drop_index(op.f('ix_signed_contracts_status'), table_name='signed_contracts')
    op.drop_index(op.f('ix_signed_contracts_matter_id'), table_name='signed_contracts')
    op.drop_index(op.f('ix_signed_contracts_client_id'), table_name='signed_contracts')
    op.drop_index(op.f('ix_signature_recipients_recipient_id'), table_name='signature_recipients')
    op.drop_index(op.f('ix_matter_tasks_assigned_to'), table_name='matter_tasks')
    op.drop_index(op.f('ix_matter_documents_uploaded_by_contact_id'), table_name='matter_documents')
    op.drop_index(op.f('ix_matter_documents_uploaded_by'), table_name='matter_documents')
    op.drop_index(op.f('ix_matter_assignments_user_id'), table_name='matter_assignments')
    op.drop_index(op.f('ix_matter_approvals_requested_by'), table_name='matter_approvals')
    op.drop_index(op.f('ix_matter_approvals_decided_by'), table_name='matter_approvals')
    op.drop_index(op.f('ix_knowledge_articles_created_by'), table_name='knowledge_articles')
    op.drop_index(op.f('ix_intake_submissions_status'), table_name='intake_submissions')
    op.drop_index(op.f('ix_intake_submissions_contact_id'), table_name='intake_submissions')
    op.drop_index(op.f('ix_intake_submissions_client_id'), table_name='intake_submissions')
    op.drop_index(op.f('ix_firm_integrations_configured_by'), table_name='firm_integrations')
    op.drop_index(op.f('ix_client_contacts_client_id'), table_name='client_contacts')
    op.drop_index(op.f('ix_audit_logs_target_type'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_target_id'), table_name='audit_logs')
    op.drop_index(op.f('ix_audit_logs_action'), table_name='audit_logs')
