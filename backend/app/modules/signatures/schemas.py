from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.modules.notifications.models import RecipientType
from app.modules.signatures.models import SignatureRequestStatus, SignatureRecipientStatus


class SignatureRecipientInput(BaseModel):
    recipient_type: RecipientType
    recipient_id: UUID


class CreateSignatureRequestRequest(BaseModel):
    source_document_id: UUID
    title: str = Field(min_length=2, max_length=200)
    recipients: list[SignatureRecipientInput] = Field(min_length=1, max_length=20)


class SignatureRecipientResponse(BaseModel):
    id: UUID
    recipient_type: RecipientType
    recipient_id: UUID
    name: str
    email: str
    signing_order: int
    status: SignatureRecipientStatus
    signing_url: str
    signed_at: datetime | None

    class Config:
        from_attributes = True


class SignatureRequestResponse(BaseModel):
    id: UUID
    matter_id: UUID
    client_id: UUID
    source_document_id: UUID
    title: str
    status: SignatureRequestStatus
    requested_by: UUID
    completed_at: datetime | None
    signed_contract_id: UUID | None
    recipients: list[SignatureRecipientResponse]
    created_at: datetime

    class Config:
        from_attributes = True
