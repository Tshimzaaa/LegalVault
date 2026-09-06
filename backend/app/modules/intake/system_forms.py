"""Seeds the per-firm "Request Support" system intake form.

This form replaces what used to be the separate, fixed-schema SupportRequest feature —
folding it into intake so clients fill out one kind of form and staff triage one kind of
inbox. Its fields mirror the old fixed columns exactly (see the migration that backfilled
existing support_requests rows) so historical and new requests carry identical labels.

Keep this spec in sync with the equivalent constant duplicated in the
`seed_system_request_support_form` Alembic migration — that copy is intentionally frozen
to the schema as it existed at that revision and must not import this module.
"""

from uuid import UUID
from sqlalchemy.orm import Session

from app.modules.intake.repository import IntakeRepository
from app.modules.intake.models import IntakeFieldType, IntakeForm, IntakeFormField

SUPPORT_REQUEST_FORM_TITLE = "Request Support"
SUPPORT_REQUEST_FORM_DESCRIPTION = (
    "Ask legal for help with an NDA, consultancy or supplier agreement, or a general question."
)

# (key, label, field_type, is_required, options)
SUPPORT_REQUEST_FIELDS: list[tuple[str, str, IntakeFieldType, bool, list[str] | None]] = [
    (
        "request_type",
        "Request Type",
        IntakeFieldType.DROPDOWN,
        True,
        ["NDA Review", "Consultancy Agreement", "Supplier Agreement", "General Inquiry"],
    ),
    ("counterparty", "Vendor / Counterparty", IntakeFieldType.TEXT, False, None),
    ("priority", "Priority", IntakeFieldType.DROPDOWN, False, ["High", "Medium", "Low"]),
    ("needed_by", "Needed By", IntakeFieldType.DATE, False, None),
    ("description", "What do you need help with?", IntakeFieldType.TEXTAREA, True, None),
    ("reference_documents", "Reference Documents", IntakeFieldType.TEXT, False, None),
]


def seed_system_support_form(db: Session, firm_id: UUID) -> IntakeForm:
    repository = IntakeRepository(db)

    form = IntakeForm(
        firm_id=firm_id,
        title=SUPPORT_REQUEST_FORM_TITLE,
        description=SUPPORT_REQUEST_FORM_DESCRIPTION,
        is_published=True,
        is_system=True,
        created_by=None,
    )
    repository.create_form(form)

    for order, (key, label, field_type, is_required, options) in enumerate(SUPPORT_REQUEST_FIELDS):
        repository.create_field(
            IntakeFormField(
                form_id=form.id,
                label=label,
                key=key,
                field_type=field_type,
                is_required=is_required,
                options=options,
                display_order=order,
            )
        )

    return form
