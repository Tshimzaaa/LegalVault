from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field

from app.modules.intake.models import IntakeFieldType, IntakeSubmissionStatus


class IntakeFormFieldCreateRequest(BaseModel):
    label: str = Field(min_length=1, max_length=200)
    field_type: IntakeFieldType
    is_required: bool = False
    help_text: str | None = Field(default=None, max_length=500)
    options: list[str] | None = None


class IntakeFormFieldUpdateRequest(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=200)
    field_type: IntakeFieldType | None = None
    is_required: bool | None = None
    help_text: str | None = Field(default=None, max_length=500)
    options: list[str] | None = None


class ReorderFieldsRequest(BaseModel):
    field_ids: list[UUID]


class IntakeFormFieldResponse(BaseModel):
    id: UUID
    form_id: UUID
    label: str
    field_type: IntakeFieldType
    is_required: bool
    help_text: str | None
    options: list[str] | None
    display_order: int

    class Config:
        from_attributes = True


class CreateIntakeFormRequest(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str | None = None


class UpdateIntakeFormRequest(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    description: str | None = None
    is_published: bool | None = None


class IntakeFormResponse(BaseModel):
    id: UUID
    firm_id: UUID
    title: str
    description: str | None
    is_published: bool
    created_at: datetime
    updated_at: datetime
    fields: list[IntakeFormFieldResponse] = []

    class Config:
        from_attributes = True


class IntakeSubmissionAnswerResponse(BaseModel):
    id: UUID
    field_id: UUID
    value: str | None
    original_filename: str | None
    content_type: str | None

    class Config:
        from_attributes = True


class IntakeSubmissionResponse(BaseModel):
    id: UUID
    firm_id: UUID
    form_id: UUID
    client_id: UUID
    contact_id: UUID
    status: IntakeSubmissionStatus
    converted_matter_id: UUID | None
    created_at: datetime
    updated_at: datetime
    answers: list[IntakeSubmissionAnswerResponse] = []

    class Config:
        from_attributes = True


class UpdateIntakeSubmissionStatusRequest(BaseModel):
    status: IntakeSubmissionStatus


class ConvertIntakeSubmissionRequest(BaseModel):
    matter_title: str | None = Field(default=None, max_length=200)


class IntakeAnswerDownloadResponse(BaseModel):
    download_url: str
    expires_in_seconds: int
