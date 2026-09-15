"""drop client tier

Part of the corporate-pivot rebuild: the "Client"/"ClientContact" subordinate
tier (a law firm's own customer company, and that company's restricted-portal
login accounts) is removed entirely — the org itself is now the only tenant,
with no second party managed underneath it. Drops the clients/client_contacts
tables and everything that FK'd into them (matter_contact_permissions, the
whole intake module which was the client-facing "Request Support" flow), and
strips client_id/is_visible_to_client/uploaded_by_contact_id from the tables
that still exist. Also reshapes signature_recipients: an external signer
(someone outside the org) is no longer looked up via a ClientContact account —
they're identified by free-form external_name/external_email instead.

Revision ID: b5fc97d5dec6
Revises: 7be238228b8e
Create Date: 2026-09-15 03:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b5fc97d5dec6'
down_revision: Union[str, Sequence[str], None] = '7be238228b8e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Columns that pointed at (or gated visibility for) the client tier must lose
    # their FK constraints before the tables on the other end can be dropped.
    op.drop_constraint("fk_matters_client_id_clients", "matters", type_="foreignkey")
    op.drop_column("matters", "client_id")
    op.drop_column("matters", "is_visible_to_client")

    op.drop_constraint("fk_matter_documents_uploaded_by_contact_id_client_contacts", "matter_documents", type_="foreignkey")
    op.drop_column("matter_documents", "uploaded_by_contact_id")

    op.drop_constraint("fk_signed_contracts_client_id_clients", "signed_contracts", type_="foreignkey")
    op.drop_column("signed_contracts", "client_id")

    op.drop_constraint("fk_signature_requests_client_id_clients", "signature_requests", type_="foreignkey")
    op.drop_column("signature_requests", "client_id")

    # Tables that only ever existed to serve the client tier — RLS policies and
    # indexes on them are dropped automatically along with the table.
    op.drop_table("matter_contact_permissions")
    op.drop_table("intake_submission_answers")
    op.drop_table("intake_submissions")
    op.drop_table("intake_form_fields")
    op.drop_table("intake_forms")
    op.drop_table("client_contacts")
    op.drop_table("clients")

    # signature_recipients: recipient_type/recipient_id become optional (an internal
    # user), and two new optional columns carry an external signer's contact info
    # directly instead of pointing at a ClientContact account.
    op.alter_column("signature_recipients", "recipient_type", nullable=True)
    op.alter_column("signature_recipients", "recipient_id", nullable=True)
    op.add_column("signature_recipients", sa.Column("external_name", sa.String(length=200), nullable=True))
    op.add_column("signature_recipients", sa.Column("external_email", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("signature_recipients", "external_email")
    op.drop_column("signature_recipients", "external_name")
    op.alter_column("signature_recipients", "recipient_id", nullable=False)
    op.alter_column("signature_recipients", "recipient_type", nullable=False)

    op.add_column("signature_requests", sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False))
    op.add_column("signed_contracts", sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False))
    op.add_column("matter_documents", sa.Column("uploaded_by_contact_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("matters", sa.Column("is_visible_to_client", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("matters", sa.Column("client_id", postgresql.UUID(as_uuid=True), nullable=False))

    op.create_table(
        "clients",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("org_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("organizations.id"), nullable=False, index=True),
        sa.Column("company_name", sa.String(length=200), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_foreign_key("fk_matters_client_id_clients", "matters", "clients", ["client_id"], ["id"])
    op.create_foreign_key("fk_signed_contracts_client_id_clients", "signed_contracts", "clients", ["client_id"], ["id"])
    op.create_foreign_key("fk_signature_requests_client_id_clients", "signature_requests", "clients", ["client_id"], ["id"])

    # client_contacts, intake_*, and matter_contact_permissions are not
    # recreated on downgrade — this migration's downgrade path exists to undo
    # the org/matter/contract schema changes, not to fully resurrect the
    # deleted client-portal feature set.
