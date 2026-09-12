"""add other request type and doc upload fields to request support form

Updates every firm's existing system-seeded "Request Support" intake form
(see c3d4e5f6a7b8_seed_system_request_support_form.py and
app.modules.intake.system_forms — both updated to match going forward) to:

  - add "Other" to the request_type dropdown's options
  - insert a new optional "other_request_type" field right after it, shown/
    required client-side only when request_type is answered "Other"
  - append a new optional "reference_document_upload" FILE field after the
    existing reference_documents (link) field, for firms who want to upload
    a document instead of pasting a URL

Pure data migration — no schema change (IntakeFieldType.FILE already existed).
Both intake_forms and intake_form_fields are under FORCE ROW LEVEL SECURITY
(see 2c6187c448a9_add_intake_rls.py), so this needs `SET app.is_owner = 'true'`
first, same as the original seeding migration.

Revision ID: b4c5d6e7f8a9
Revises: a3b4c5d6e7f8
Create Date: 2026-09-12 00:00:00.000000

"""
import json
import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b4c5d6e7f8a9'
down_revision: Union[str, Sequence[str], None] = 'a3b4c5d6e7f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

ORIGINAL_REQUEST_TYPE_OPTIONS = ["NDA Review", "Consultancy Agreement", "Supplier Agreement", "General Inquiry"]
NEW_REQUEST_TYPE_OPTIONS = ORIGINAL_REQUEST_TYPE_OPTIONS + ["Other"]


def _now():
    return datetime.now(timezone.utc)


def upgrade() -> None:
    op.execute("SET app.is_owner = 'true'")
    bind = op.get_bind()

    form_ids = [
        row[0]
        for row in bind.execute(
            sa.text("SELECT id FROM intake_forms WHERE is_system = true AND title = 'Request Support'")
        ).all()
    ]

    for form_id in form_ids:
        bind.execute(
            sa.text(
                "UPDATE intake_form_fields SET options = :options, updated_at = :now "
                "WHERE form_id = :form_id AND key = 'request_type'"
            ),
            {"options": json.dumps(NEW_REQUEST_TYPE_OPTIONS), "now": _now(), "form_id": form_id},
        )

        # Make room right after request_type (display_order 0) for the new "specify" field.
        bind.execute(
            sa.text(
                "UPDATE intake_form_fields SET display_order = display_order + 1, updated_at = :now "
                "WHERE form_id = :form_id AND display_order >= 1"
            ),
            {"now": _now(), "form_id": form_id},
        )

        max_order = bind.execute(
            sa.text("SELECT MAX(display_order) FROM intake_form_fields WHERE form_id = :form_id"),
            {"form_id": form_id},
        ).scalar()

        now = _now()
        bind.execute(
            sa.text(
                "INSERT INTO intake_form_fields "
                "(id, form_id, label, key, field_type, is_required, help_text, options, display_order, "
                "created_at, updated_at) "
                "VALUES (:id, :form_id, :label, :key, :field_type, false, null, null, :display_order, :now, :now)"
            ),
            {
                "id": uuid.uuid4(),
                "form_id": form_id,
                "label": "Please specify",
                "key": "other_request_type",
                "field_type": "TEXT",
                "display_order": 1,
                "now": now,
            },
        )
        bind.execute(
            sa.text(
                "INSERT INTO intake_form_fields "
                "(id, form_id, label, key, field_type, is_required, help_text, options, display_order, "
                "created_at, updated_at) "
                "VALUES (:id, :form_id, :label, :key, :field_type, false, null, null, :display_order, :now, :now)"
            ),
            {
                "id": uuid.uuid4(),
                "form_id": form_id,
                "label": "Or Upload a Document",
                "key": "reference_document_upload",
                "field_type": "FILE",
                "display_order": (max_order or 0) + 1,
                "now": now,
            },
        )

        bind.execute(
            sa.text(
                "UPDATE intake_form_fields SET label = 'Reference Documents (link)', updated_at = :now "
                "WHERE form_id = :form_id AND key = 'reference_documents'"
            ),
            {"now": _now(), "form_id": form_id},
        )


def downgrade() -> None:
    op.execute("SET app.is_owner = 'true'")
    bind = op.get_bind()

    form_ids = [
        row[0]
        for row in bind.execute(
            sa.text("SELECT id FROM intake_forms WHERE is_system = true AND title = 'Request Support'")
        ).all()
    ]

    for form_id in form_ids:
        bind.execute(
            sa.text(
                "DELETE FROM intake_form_fields WHERE form_id = :form_id "
                "AND key IN ('other_request_type', 'reference_document_upload')"
            ),
            {"form_id": form_id},
        )
        bind.execute(
            sa.text(
                "UPDATE intake_form_fields SET display_order = display_order - 1, updated_at = :now "
                "WHERE form_id = :form_id AND display_order >= 1"
            ),
            {"now": _now(), "form_id": form_id},
        )
        bind.execute(
            sa.text(
                "UPDATE intake_form_fields SET options = :options, updated_at = :now "
                "WHERE form_id = :form_id AND key = 'request_type'"
            ),
            {"options": json.dumps(ORIGINAL_REQUEST_TYPE_OPTIONS), "now": _now(), "form_id": form_id},
        )
        bind.execute(
            sa.text(
                "UPDATE intake_form_fields SET label = 'Reference Documents', updated_at = :now "
                "WHERE form_id = :form_id AND key = 'reference_documents'"
            ),
            {"now": _now(), "form_id": form_id},
        )
