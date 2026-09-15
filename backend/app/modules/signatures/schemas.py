from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.modules.notifications.models import RecipientType
from app.modules.signatures.models import SignatureRequestStatus, SignatureRecipientStatus


class SignatureRecipientInput(BaseModel):
    # Either recipient_id (an internal org user) or external_name + external_email
    # (an external signer with no account, e.g. a counterparty) must be provided.
    recipient_id: UUID | None = None
    external_name: str | None = None
    external_email: str | None = None

    @model_validator(mode="after")
    def _require_internal_or_external(self):
        if self.recipient_id is None and not (self.external_name and self.external_email):
            raise ValueError(
                "Provide either recipient_id, or both external_name and external_email."
            )
        return self


class CreateSignatureRequestRequest(BaseModel):
    source_document_id: UUID
    title: str = Field(min_length=2, max_length=200)
    recipients: list[SignatureRecipientInput] = Field(min_length=1, max_length=20)


class SignatureRecipientResponse(BaseModel):
    id: UUID
    recipient_type: RecipientType | None
    recipient_id: UUID | None
    external_name: str | None
    external_email: str | None
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
