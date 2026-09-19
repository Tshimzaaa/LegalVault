from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from app.core.constants import NAME_MAX_LENGTH, PHONE_MAX_LENGTH
from app.modules.inquiries.models import InquiryKind, InquiryStatus

MESSAGE_MAX_LENGTH = 5000
NOTE_MAX_LENGTH = 2000


class CreateInquiryRequest(BaseModel):
    kind: InquiryKind = InquiryKind.CONTACT
    name: str = Field(min_length=2, max_length=NAME_MAX_LENGTH)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=PHONE_MAX_LENGTH)
    organization_name: str | None = Field(default=None, max_length=NAME_MAX_LENGTH)
    message: str | None = Field(default=None, max_length=MESSAGE_MAX_LENGTH)
    consent: bool
    # Honeypot: real people never see this field, so anything in it means a bot.
    website: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def _check_required_by_kind(self):
        if not self.consent:
            raise ValueError("Consent is required.")
        self.organization_name = (self.organization_name or "").strip() or None
        self.message = (self.message or "").strip() or None
        if self.kind == InquiryKind.ACCESS_REQUEST and not self.organization_name:
            raise ValueError("Organization name is required for an access request.")
        if self.kind == InquiryKind.CONTACT and not self.message:
            raise ValueError("A message is required.")
        return self


class CreateInquiryResponse(BaseModel):
    message: str


class InquiryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    kind: InquiryKind
    status: InquiryStatus
    name: str
    email: str
    phone: str | None
    organization_name: str | None
    message: str | None
    owner_note: str | None
    handled_at: datetime | None
    organization_id: UUID | None
    created_at: datetime


class InquiryListResponse(BaseModel):
    items: list[InquiryResponse]
    total: int


class InquirySummaryResponse(BaseModel):
    new: int
    in_progress: int
    onboarded: int
    closed: int
    new_access_requests: int
    new_contact: int


class UpdateInquiryRequest(BaseModel):
    status: InquiryStatus | None = None
    owner_note: str | None = Field(default=None, max_length=NOTE_MAX_LENGTH)
    organization_id: UUID | None = None
