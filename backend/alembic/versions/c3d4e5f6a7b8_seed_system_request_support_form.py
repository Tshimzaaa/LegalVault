"""seed_system_request_support_form

Step 3 of the support-requests-to-intake merge. Seeds one system-owned,
published "Request Support" intake form per existing firm, with six fields
mirroring the old fixed SupportRequest schema exactly (see the field table
below and the backfill migration that follows this one).

This field spec is intentionally duplicated here and in
app.modules.intake.system_forms.SUPPORT_REQUEST_FIELDS (used going forward
for newly-registered firms) rather than shared — this migration is pinned to
the schema as it existed at this revision and must not import live app code.

Both intake_forms and intake_form_fields are under FORCE ROW LEVEL SECURITY
(see 2c6187c448a9_add_intake_rls.py); per that migration's warning, writing
to them here requires `SET app.is_owner = 'true'` first or every insert
would silently touch zero rows.

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-09-05 00:00:02.000000

"""
import uuid
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FORM_TITLE = "Request Support"
FORM_DESCRIPTION = "Ask legal for help with an NDA, consultancy or supplier agreement, or a general question."

# (key, label, field_type, is_required, options)
FIELDS: list[tuple[str, str, str, bool, list[str] | None]] = [
    (
        "request_type",
        "Request Type",
        "DROPDOWN",
        True,
        ["NDA Review", "Consultancy Agreement", "Supplier Agreement", "General Inquiry"],
    ),
    ("counterparty", "Vendor / Counterparty", "TEXT", False, None),
    ("priority", "Priority", "DROPDOWN", False, ["High", "Medium", "Low"]),
    ("needed_by", "Needed By", "DATE", False, None),
    ("description", "What do you need help with?", "TEXTAREA", True, None),
    ("reference_documents", "Reference Documents", "TEXT", False, None),
]


def _now():
    return datetime.now(timezone.utc)


def upgrade() -> None:
    op.execute("SET app.is_owner = 'true'")
    bind = op.get_bind()

    intake_forms = sa.table(
        "intake_forms",
        sa.column("id", sa.UUID()),
        sa.column("firm_id", sa.UUID()),
        sa.column("title", sa.String()),
        sa.column("description", sa.Text()),
        sa.column("is_published", sa.Boolean()),
        sa.column("is_system", sa.Boolean()),
        sa.column("created_by", sa.UUID()),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    intake_form_fields = sa.table(
        "intake_form_fields",
        sa.column("id", sa.UUID()),
        sa.column("form_id", sa.UUID()),
        sa.column("label", sa.String()),
        sa.column("key", sa.String()),
        sa.column("field_type", sa.String()),
        sa.column("is_required", sa.Boolean()),
        sa.column("help_text", sa.String()),
        sa.column("options", sa.JSON()),
        sa.column("display_order", sa.Integer()),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )

    firm_ids = [row[0] for row in bind.execute(sa.text("SELECT id FROM law_firms")).all()]

    for firm_id in firm_ids:
        form_id = uuid.uuid4()
        now = _now()
        bind.execute(
            intake_forms.insert().values(
                id=form_id,
                firm_id=firm_id,
                title=FORM_TITLE,
                description=FORM_DESCRIPTION,
                is_published=True,
                is_system=True,
                created_by=None,
                created_at=now,
                updated_at=now,
            )
        )
        for order, (key, label, field_type, is_required, options) in enumerate(FIELDS):
            field_now = _now()
            bind.execute(
                intake_form_fields.insert().values(
                    id=uuid.uuid4(),
                    form_id=form_id,
                    label=label,
                    key=key,
                    field_type=field_type,
                    is_required=is_required,
                    help_text=None,
                    options=options,
                    display_order=order,
                    created_at=field_now,
                    updated_at=field_now,
                )
            )


def downgrade() -> None:
    op.execute("SET app.is_owner = 'true'")
    op.execute(
        "DELETE FROM intake_form_fields WHERE form_id IN (SELECT id FROM intake_forms WHERE is_system = true)"
    )
    op.execute("DELETE FROM intake_forms WHERE is_system = true")
