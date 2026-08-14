from uuid import UUID

from sqlalchemy import Boolean, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING
import enum

from app.database.base import BaseModel

if TYPE_CHECKING:
    from app.modules.auth.models.law_firm import LawFirm
    from app.modules.clients.models import Client, ClientContact
    from app.modules.matters.models import Matter


class IntakeFieldType(str, enum.Enum):
    TEXT = "text"
    TEXTAREA = "textarea"
    NUMBER = "number"
    DATE = "date"
    DROPDOWN = "dropdown"
    CHECKBOX = "checkbox"
    FILE = "file"


class IntakeSubmissionStatus(str, enum.Enum):
    SUBMITTED = "submitted"
    IN_REVIEW = "in_review"
    CONVERTED = "converted"
    DECLINED = "declined"


class IntakeForm(BaseModel):
    __tablename__ = "intake_forms"

    firm_id: Mapped[UUID] = mapped_column(
        ForeignKey("law_firms.id"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)

    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    fields: Mapped[list["IntakeFormField"]] = relationship(
        "IntakeFormField",
        back_populates="form",
        order_by="IntakeFormField.display_order",
    )


class IntakeFormField(BaseModel):
    __tablename__ = "intake_form_fields"

    form_id: Mapped[UUID] = mapped_column(
        ForeignKey("intake_forms.id"),
        nullable=False,
        index=True,
    )

    label: Mapped[str] = mapped_column(String(200), nullable=False)

    field_type: Mapped[IntakeFieldType] = mapped_column(Enum(IntakeFieldType), nullable=False)

    is_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    help_text: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Dropdown choices, e.g. ["Yes", "No"] — null/unused for every other field_type.
    options: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    display_order: Mapped[int] = mapped_column(nullable=False, default=0)

    form: Mapped["IntakeForm"] = relationship(
        "IntakeForm",
        back_populates="fields",
    )


class IntakeSubmission(BaseModel):
    __tablename__ = "intake_submissions"

    firm_id: Mapped[UUID] = mapped_column(
        ForeignKey("law_firms.id"),
        nullable=False,
        index=True,
    )

    form_id: Mapped[UUID] = mapped_column(
        ForeignKey("intake_forms.id"),
        nullable=False,
        index=True,
    )

    client_id: Mapped[UUID] = mapped_column(
        ForeignKey("clients.id"),
        nullable=False,
    )

    contact_id: Mapped[UUID] = mapped_column(
        ForeignKey("client_contacts.id"),
        nullable=False,
    )

    status: Mapped[IntakeSubmissionStatus] = mapped_column(
        Enum(IntakeSubmissionStatus),
        default=IntakeSubmissionStatus.SUBMITTED,
        nullable=False,
    )

    converted_matter_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("matters.id"),
        nullable=True,
    )

    answers: Mapped[list["IntakeSubmissionAnswer"]] = relationship(
        "IntakeSubmissionAnswer",
        back_populates="submission",
    )


class IntakeSubmissionAnswer(BaseModel):
    __tablename__ = "intake_submission_answers"

    submission_id: Mapped[UUID] = mapped_column(
        ForeignKey("intake_submissions.id"),
        nullable=False,
        index=True,
    )

    field_id: Mapped[UUID] = mapped_column(
        ForeignKey("intake_form_fields.id"),
        nullable=False,
    )

    # Holds the scalar answer for every non-file field_type (text/textarea/number/date/
    # dropdown/checkbox("true"/"false")) — interpreted per the parent field's field_type.
    # Null for FILE-type answers, which use the three columns below instead.
    value: Mapped[str | None] = mapped_column(Text, nullable=True)

    file_key: Mapped[str | None] = mapped_column(String(500), nullable=True)

    original_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)

    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)

    submission: Mapped["IntakeSubmission"] = relationship(
        "IntakeSubmission",
        back_populates="answers",
    )
