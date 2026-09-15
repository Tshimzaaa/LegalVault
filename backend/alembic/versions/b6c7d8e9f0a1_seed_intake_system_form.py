"""seed intake system form for existing orgs

Revision ID: b6c7d8e9f0a1
Revises: a5b6c7d8e9f0
Create Date: 2026-09-15 00:00:02.000000

New orgs get the "Contract Request" system form seeded at registration (see
RegisterService), but any org created before this migration needs a one-time
backfill so the intake feature isn't silently unavailable to them.
"""
import json
from typing import Sequence, Union
from uuid import uuid4

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b6c7d8e9f0a1'
down_revision: Union[str, Sequence[str], None] = 'a5b6c7d8e9f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Kept in sync with app.modules.intake.system_forms — intentionally duplicated
# (not imported) so this migration stays frozen to the schema as it existed here.
_FORM_TITLE = "Contract Request"
_FORM_DESCRIPTION = (
    "Ask legal to draft, review, or renew a contract — an NDA, supplier agreement, "
    "vendor deal, or partnership agreement."
)
_FIELDS = [
    ("request_type", "Request Type", "DROPDOWN", True,
     ["New Contract", "Amendment", "Renewal", "NDA", "General Inquiry", "Other"]),
    ("other_request_type", "Please specify", "TEXT", False, None),
    ("counterparty", "Counterparty (supplier / vendor / partner)", "TEXT", False, None),
    ("priority", "Priority", "DROPDOWN", False, ["High", "Medium", "Low"]),
    ("needed_by", "Needed By", "DATE", False, None),
    ("description", "What do you need?", "TEXTAREA", True, None),
    ("reference_documents", "Reference Documents (link)", "TEXT", False, None),
    ("reference_document_upload", "Or Upload a Document", "FILE", False, None),
]


def upgrade() -> None:
    conn = op.get_bind()
    org_ids = [row[0] for row in conn.execute(sa.text("SELECT id FROM organizations")).fetchall()]

    for org_id in org_ids:
        existing = conn.execute(
            sa.text("SELECT 1 FROM intake_forms WHERE org_id = :org_id AND is_system = true"),
            {"org_id": org_id},
        ).fetchone()
        if existing:
            continue

        form_id = uuid4()
        conn.execute(
            sa.text(
                """
                INSERT INTO intake_forms
                    (id, created_at, updated_at, org_id, title, description, is_published, is_system, created_by)
                VALUES
                    (:id, now(), now(), :org_id, :title, :description, true, true, NULL)
                """
            ),
            {"id": form_id, "org_id": org_id, "title": _FORM_TITLE, "description": _FORM_DESCRIPTION},
        )

        for order, (key, label, field_type, is_required, options) in enumerate(_FIELDS):
            conn.execute(
                sa.text(
                    """
                    INSERT INTO intake_form_fields
                        (id, created_at, updated_at, form_id, label, key, field_type, is_required,
                         help_text, options, display_order)
                    VALUES
                        (:id, now(), now(), :form_id, :label, :key, :field_type, :is_required,
                         NULL, CAST(:options AS jsonb), :display_order)
                    """
                ),
                {
                    "id": uuid4(),
                    "form_id": form_id,
                    "label": label,
                    "key": key,
                    "field_type": field_type,
                    "is_required": is_required,
                    "options": json.dumps(options) if options is not None else None,
                    "display_order": order,
                },
            )


def downgrade() -> None:
    # Data-only migration — no schema to revert, and removing the seeded forms on
    # downgrade could delete real submissions/answers an org has already created
    # against them. Intentionally a no-op.
    pass
