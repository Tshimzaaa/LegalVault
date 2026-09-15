"""Seeds the per-org "Contract Request" system intake form.

In this corporate/in-house model there's no external client — any employee
(procurement, sales, a business-unit lead) can submit a structured request for
legal to draft or review a contract, which legal then triages and converts
into a Contract.
"""

from uuid import UUID
from sqlalchemy.orm import Session

from app.modules.intake.repository import IntakeRepository
from app.modules.intake.models import IntakeFieldType, IntakeForm, IntakeFormField

CONTRACT_REQUEST_FORM_TITLE = "Contract Request"
CONTRACT_REQUEST_FORM_DESCRIPTION = (
    "Ask legal to draft, review, or renew a contract — an NDA, supplier agreement, "
    "vendor deal, or partnership agreement."
)

# (key, label, field_type, is_required, options)
CONTRACT_REQUEST_FIELDS: list[tuple[str, str, IntakeFieldType, bool, list[str] | None]] = [
    (
        "request_type",
        "Request Type",
        IntakeFieldType.DROPDOWN,
        True,
        ["New Contract", "Amendment", "Renewal", "NDA", "General Inquiry", "Other"],
    ),
    # Only shown/required client-side when request_type is answered "Other" — the generic
    # required-field check has no notion of one field depending on another's value, so this
    # stays optional here and the frontend enforces it conditionally.
    ("other_request_type", "Please specify", IntakeFieldType.TEXT, False, None),
    ("counterparty", "Counterparty (supplier / vendor / partner)", IntakeFieldType.TEXT, False, None),
    ("priority", "Priority", IntakeFieldType.DROPDOWN, False, ["High", "Medium", "Low"]),
    ("needed_by", "Needed By", IntakeFieldType.DATE, False, None),
    ("description", "What do you need?", IntakeFieldType.TEXTAREA, True, None),
    ("reference_documents", "Reference Documents (link)", IntakeFieldType.TEXT, False, None),
    ("reference_document_upload", "Or Upload a Document", IntakeFieldType.FILE, False, None),
]


def seed_system_support_form(db: Session, org_id: UUID) -> IntakeForm:
    repository = IntakeRepository(db)

    form = IntakeForm(
        org_id=org_id,
        title=CONTRACT_REQUEST_FORM_TITLE,
        description=CONTRACT_REQUEST_FORM_DESCRIPTION,
        is_published=True,
        is_system=True,
        created_by=None,
    )
    repository.create_form(form)

    for order, (key, label, field_type, is_required, options) in enumerate(CONTRACT_REQUEST_FIELDS):
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
