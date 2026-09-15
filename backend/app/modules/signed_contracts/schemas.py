from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel

from app.modules.signed_contracts.models import ContractStatus, ContractType


class SignedContractResponse(BaseModel):
    id: UUID
    org_id: UUID
    contract_id: UUID | None
    title: str
    description: str | None
    agreement_type: ContractType
    signed_date: date
    expiry_date: date | None
    integration_source: str
    # Derived at read time: "active" | "expiring" | "archived" — see ContractStatus note in models.py.
    status: str
    original_filename: str
    content_type: str
    created_at: datetime

    class Config:
        from_attributes = True


class SignedContractDownloadResponse(BaseModel):
    download_url: str
    expires_in_seconds: int


class SignedContractsSummaryResponse(BaseModel):
    total: int
    active: int
    expiring_soon: int


class UpdateSignedContractStatusRequest(BaseModel):
    status: ContractStatus
