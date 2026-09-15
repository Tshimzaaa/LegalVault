from uuid import UUID
from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, Field

from app.modules.contracts.models import (
    ContractStage,
    ContractRole,
    TaskStatus,
    MessageAuthorType,
    ApprovalStatus,
)


class CreateContractRequest(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str | None = None
    due_date: date | None = None


class UpdateContractDetailsRequest(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str | None = None


class UpdateContractStageRequest(BaseModel):
    status: ContractStage


class UpdateContractDeadlineRequest(BaseModel):
    due_date: date | None = None


class ContractResponse(BaseModel):
    id: UUID
    org_id: UUID
    title: str
    description: str | None
    status: ContractStage
    due_date: date | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AssignStaffRequest(BaseModel):
    user_id: UUID
    role_on_contract: ContractRole


class ContractAssignmentResponse(BaseModel):
    id: UUID
    contract_id: UUID
    user_id: UUID
    role_on_contract: ContractRole

    class Config:
        from_attributes = True

class ContractDocumentResponse(BaseModel):
    id: UUID
    contract_id: UUID
    uploaded_by: UUID | None
    title: str
    version: int
    original_filename: str
    content_type: str
    created_at: datetime

    class Config:
        from_attributes = True


class ContractDocumentDownloadResponse(BaseModel):
    download_url: str
    expires_in_seconds: int


class CreateContractTaskRequest(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str | None = None
    assigned_to: UUID | None = None
    due_date: date | None = None


class UpdateContractTaskRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    assigned_to: UUID | None = None
    due_date: date | None = None
    status: TaskStatus | None = None


class ContractTaskResponse(BaseModel):
    id: UUID
    contract_id: UUID
    title: str
    description: str | None
    assigned_to: UUID | None
    due_date: date | None
    status: TaskStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CalendarEvent(BaseModel):
    date: date
    type: str  # "contract_deadline" | "task_due"
    title: str
    contract_id: UUID
    contract_title: str
    task_id: UUID | None = None


class CreateContractMessageRequest(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class ContractMessageResponse(BaseModel):
    id: UUID
    contract_id: UUID
    author_type: MessageAuthorType
    author_id: UUID
    author_name: str
    body: str
    created_at: datetime

    class Config:
        from_attributes = True


class RequestContractApprovalRequest(BaseModel):
    to_status: ContractStage


class DecideContractApprovalRequest(BaseModel):
    decision: Literal["approved", "rejected"]
    note: str | None = Field(default=None, max_length=500)


class ContractApprovalResponse(BaseModel):
    id: UUID
    contract_id: UUID
    requested_by: UUID
    from_status: ContractStage
    to_status: ContractStage
    status: ApprovalStatus
    decided_by: UUID | None
    decided_at: datetime | None
    decision_note: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
