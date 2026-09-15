"""rename matter to contract

Part of the corporate-pivot rebuild: "Matter" (the internal case/engagement
work-item) is renamed to "Contract" — the intake -> review -> signed lifecycle
already matched a contract's life, so this is the final step of collapsing
the product's vocabulary onto the pivot's actual domain (contracts, not
law-firm matters).

Naming note: SignedContract (an already-executed, filed document) already
exists as a separate model/table and is NOT touched here — a plain rename of
Matter's status enum to "ContractStatus" would collide with
SignedContract.status (active/expired/terminated, an unrelated value set), so
Matter's status enum becomes ContractStage / `contractstage` instead.
ApprovalStatus's Postgres type was explicitly named 'matterapprovalstatus' in
the original migration; renamed to 'approvalstatus' to match what SQLAlchemy
now derives implicitly from the (unrenamed) ApprovalStatus class name.

Revision ID: bb57b326ebe5
Revises: a4a2eb2849a8
Create Date: 2026-09-15 04:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'bb57b326ebe5'
down_revision: Union[str, Sequence[str], None] = 'a4a2eb2849a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# (old_table, new_table) for every table renamed in this migration.
_TABLE_RENAMES = [
    ("matters", "contracts"),
    ("matter_assignments", "contract_assignments"),
    ("matter_documents", "contract_documents"),
    ("matter_tasks", "contract_tasks"),
    ("matter_messages", "contract_messages"),
    ("matter_approvals", "contract_approvals"),
]

# Tables (old name) with a matter_id FK column to rename to contract_id —
# includes signed_contracts/signature_requests, which aren't themselves
# renamed above but still point at the matters/contracts table.
_TABLES_WITH_MATTER_ID = [
    "matter_assignments", "matter_documents", "matter_tasks",
    "matter_messages", "matter_approvals", "signed_contracts", "signature_requests",
]

_ENUM_RENAMES = [
    ("matterstatus", "contractstage"),
    ("matterrole", "contractrole"),
    ("matterapprovalstatus", "approvalstatus"),
]


def upgrade() -> None:
    for old_type, new_type in _ENUM_RENAMES:
        op.execute(f"ALTER TYPE {old_type} RENAME TO {new_type}")

    # Constraint/index/column renames, done against each table's CURRENT (old)
    # name — the table itself is renamed after, in one batch, at the end.
    for table in _TABLES_WITH_MATTER_ID:
        op.execute(f"ALTER TABLE {table} RENAME CONSTRAINT fk_{table}_matter_id_matters TO fk_{table}_contract_id_contracts")
        op.execute(f"ALTER INDEX ix_{table}_matter_id RENAME TO ix_{table}_contract_id")
        op.alter_column(table, "matter_id", new_column_name="contract_id")

    op.execute("ALTER INDEX ix_matter_approvals_one_pending_per_matter RENAME TO ix_contract_approvals_one_pending_per_contract")
    op.execute("ALTER INDEX ix_matters_search_vector RENAME TO ix_contracts_search_vector")
    op.execute("ALTER INDEX ix_matter_documents_search_vector RENAME TO ix_contract_documents_search_vector")

    op.execute("ALTER TABLE matters RENAME CONSTRAINT pk_matters TO pk_contracts")
    op.execute("ALTER TABLE matters RENAME CONSTRAINT fk_matters_org_id_organizations TO fk_contracts_org_id_organizations")
    op.execute("ALTER INDEX ix_matters_org_id RENAME TO ix_contracts_org_id")

    op.execute("ALTER TABLE matter_assignments RENAME CONSTRAINT pk_matter_assignments TO pk_contract_assignments")
    op.execute("ALTER TABLE matter_assignments RENAME CONSTRAINT fk_matter_assignments_user_id_users TO fk_contract_assignments_user_id_users")
    op.execute("ALTER INDEX ix_matter_assignments_user_id RENAME TO ix_contract_assignments_user_id")
    op.alter_column("matter_assignments", "role_on_matter", new_column_name="role_on_contract")

    op.execute("ALTER TABLE matter_documents RENAME CONSTRAINT pk_matter_documents TO pk_contract_documents")
    op.execute("ALTER TABLE matter_documents RENAME CONSTRAINT fk_matter_documents_uploaded_by_users TO fk_contract_documents_uploaded_by_users")
    op.execute("ALTER INDEX ix_matter_documents_uploaded_by RENAME TO ix_contract_documents_uploaded_by")

    op.execute("ALTER TABLE matter_tasks RENAME CONSTRAINT pk_matter_tasks TO pk_contract_tasks")
    op.execute("ALTER TABLE matter_tasks RENAME CONSTRAINT fk_matter_tasks_assigned_to_users TO fk_contract_tasks_assigned_to_users")
    op.execute("ALTER INDEX ix_matter_tasks_assigned_to RENAME TO ix_contract_tasks_assigned_to")

    op.execute("ALTER TABLE matter_messages RENAME CONSTRAINT pk_matter_messages TO pk_contract_messages")

    op.execute("ALTER TABLE matter_approvals RENAME CONSTRAINT pk_matter_approvals TO pk_contract_approvals")
    op.execute("ALTER TABLE matter_approvals RENAME CONSTRAINT fk_matter_approvals_requested_by_users TO fk_contract_approvals_requested_by_users")
    op.execute("ALTER TABLE matter_approvals RENAME CONSTRAINT fk_matter_approvals_decided_by_users TO fk_contract_approvals_decided_by_users")
    op.execute("ALTER INDEX ix_matter_approvals_status RENAME TO ix_contract_approvals_status")
    op.execute("ALTER INDEX ix_matter_approvals_requested_by RENAME TO ix_contract_approvals_requested_by")
    op.execute("ALTER INDEX ix_matter_approvals_decided_by RENAME TO ix_contract_approvals_decided_by")

    # signed_contracts/signature_requests' own matter_id FK+index are already
    # handled by the _TABLES_WITH_MATTER_ID loop above (they're in that list) —
    # only signature_requests' source_document_id FK (naming matter_documents,
    # unrelated to its own matter_id column) needs a separate rename here.
    op.execute("ALTER TABLE signature_requests RENAME CONSTRAINT fk_signature_requests_source_document_id_matter_documents TO fk_signature_requests_source_document_id_contract_documents")

    for old_table, new_table in _TABLE_RENAMES:
        op.rename_table(old_table, new_table)


def downgrade() -> None:
    for old_table, new_table in reversed(_TABLE_RENAMES):
        op.rename_table(new_table, old_table)

    op.execute("ALTER TABLE signature_requests RENAME CONSTRAINT fk_signature_requests_source_document_id_contract_documents TO fk_signature_requests_source_document_id_matter_documents")

    op.execute("ALTER INDEX ix_contract_approvals_decided_by RENAME TO ix_matter_approvals_decided_by")
    op.execute("ALTER INDEX ix_contract_approvals_requested_by RENAME TO ix_matter_approvals_requested_by")
    op.execute("ALTER INDEX ix_contract_approvals_status RENAME TO ix_matter_approvals_status")
    op.execute("ALTER TABLE matter_approvals RENAME CONSTRAINT fk_contract_approvals_decided_by_users TO fk_matter_approvals_decided_by_users")
    op.execute("ALTER TABLE matter_approvals RENAME CONSTRAINT fk_contract_approvals_requested_by_users TO fk_matter_approvals_requested_by_users")
    op.execute("ALTER TABLE matter_approvals RENAME CONSTRAINT pk_contract_approvals TO pk_matter_approvals")

    op.execute("ALTER TABLE matter_messages RENAME CONSTRAINT pk_contract_messages TO pk_matter_messages")

    op.execute("ALTER INDEX ix_contract_tasks_assigned_to RENAME TO ix_matter_tasks_assigned_to")
    op.execute("ALTER TABLE matter_tasks RENAME CONSTRAINT fk_contract_tasks_assigned_to_users TO fk_matter_tasks_assigned_to_users")
    op.execute("ALTER TABLE matter_tasks RENAME CONSTRAINT pk_contract_tasks TO pk_matter_tasks")

    op.execute("ALTER INDEX ix_contract_documents_uploaded_by RENAME TO ix_matter_documents_uploaded_by")
    op.execute("ALTER TABLE matter_documents RENAME CONSTRAINT fk_contract_documents_uploaded_by_users TO fk_matter_documents_uploaded_by_users")
    op.execute("ALTER TABLE matter_documents RENAME CONSTRAINT pk_contract_documents TO pk_matter_documents")

    op.alter_column("matter_assignments", "role_on_contract", new_column_name="role_on_matter")
    op.execute("ALTER INDEX ix_contract_assignments_user_id RENAME TO ix_matter_assignments_user_id")
    op.execute("ALTER TABLE matter_assignments RENAME CONSTRAINT fk_contract_assignments_user_id_users TO fk_matter_assignments_user_id_users")
    op.execute("ALTER TABLE matter_assignments RENAME CONSTRAINT pk_contract_assignments TO pk_matter_assignments")

    op.execute("ALTER INDEX ix_contracts_org_id RENAME TO ix_matters_org_id")
    op.execute("ALTER TABLE matters RENAME CONSTRAINT fk_contracts_org_id_organizations TO fk_matters_org_id_organizations")
    op.execute("ALTER TABLE matters RENAME CONSTRAINT pk_contracts TO pk_matters")

    op.execute("ALTER INDEX ix_contract_documents_search_vector RENAME TO ix_matter_documents_search_vector")
    op.execute("ALTER INDEX ix_contracts_search_vector RENAME TO ix_matters_search_vector")
    op.execute("ALTER INDEX ix_contract_approvals_one_pending_per_contract RENAME TO ix_matter_approvals_one_pending_per_matter")

    for table in reversed(_TABLES_WITH_MATTER_ID):
        op.alter_column(table, "contract_id", new_column_name="matter_id")
        op.execute(f"ALTER INDEX ix_{table}_contract_id RENAME TO ix_{table}_matter_id")
        op.execute(f"ALTER TABLE {table} RENAME CONSTRAINT fk_{table}_contract_id_contracts TO fk_{table}_matter_id_matters")

    for old_type, new_type in reversed(_ENUM_RENAMES):
        op.execute(f"ALTER TYPE {new_type} RENAME TO {old_type}")
