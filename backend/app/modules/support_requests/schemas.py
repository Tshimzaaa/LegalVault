from datetime import date, datetime
from uuid import UUID
from pydantic import BaseModel, Field

from app.modules.support_requests.models import (
    SupportRequestType,
    SupportRequestPriority,
    SupportRequestStatus,
)


class CreateSupportRequestRequest(BaseModel):
    request_type: SupportRequestType
    counterparty: str | None = Field(default=None, max_length=200)
    priority: SupportRequestPriority = SupportRequestPriority.MEDIUM
    needed_by: date | None = None
    description: str = Field(min_length=1)
    reference_documents: str | None = Field(default=None, max_length=500)


class UpdateSupportRequestStatusRequest(BaseModel):
    status: SupportRequestStatus


class SupportRequestResponse(BaseModel):
    id: UUID
    firm_id: UUID
    client_id: UUID
    contact_id: UUID
    request_type: SupportRequestType
    counterparty: str | None
    priority: SupportRequestPriority
    needed_by: date | None
    description: str
    reference_documents: str | None
    status: SupportRequestStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
