from uuid import UUID
from datetime import date, datetime
from pydantic import BaseModel, Field

from app.modules.matters.models import MatterStatus, MatterRole, TaskStatus, MessageAuthorType, ContactPermissionLevel


class CreateMatterRequest(BaseModel):
    client_id: UUID
    title: str = Field(min_length=2, max_length=200)
    description: str | None = None
    due_date: date | None = None


class UpdateMatterDetailsRequest(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str | None = None


class UpdateMatterStatusRequest(BaseModel):
    status: MatterStatus


class UpdateMatterVisibilityRequest(BaseModel):
    is_visible_to_client: bool


class UpdateMatterDeadlineRequest(BaseModel):
    due_date: date | None = None


class MatterResponse(BaseModel):
    id: UUID
    firm_id: UUID
    client_id: UUID
    title: str
    description: str | None
    status: MatterStatus
    is_visible_to_client: bool
    due_date: date | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AssignStaffRequest(BaseModel):
    user_id: UUID
    role_on_matter: MatterRole


class MatterAssignmentResponse(BaseModel):
    id: UUID
    matter_id: UUID
    user_id: UUID
    role_on_matter: MatterRole

    class Config:
        from_attributes = True

class MatterDocumentResponse(BaseModel):
    id: UUID
    matter_id: UUID
    uploaded_by: UUID | None
    uploaded_by_contact_id: UUID | None
    title: str
    version: int
    original_filename: str
    content_type: str
    created_at: datetime

    class Config:
        from_attributes = True


class MatterDocumentDownloadResponse(BaseModel):
    download_url: str
    expires_in_seconds: int


class CreateMatterTaskRequest(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    description: str | None = None
    assigned_to: UUID | None = None
    due_date: date | None = None


class UpdateMatterTaskRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    assigned_to: UUID | None = None
    due_date: date | None = None
    status: TaskStatus | None = None


class MatterTaskResponse(BaseModel):
    id: UUID
    matter_id: UUID
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
    type: str  # "matter_deadline" | "task_due"
    title: str
    matter_id: UUID
    matter_title: str
    task_id: UUID | None = None


class CreateMatterMessageRequest(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class MatterMessageResponse(BaseModel):
    id: UUID
    matter_id: UUID
    author_type: MessageAuthorType
    author_id: UUID
    author_name: str
    body: str
    created_at: datetime

    class Config:
        from_attributes = True


class SetContactPermissionRequest(BaseModel):
    client_contact_id: UUID
    permission_level: ContactPermissionLevel


class MatterContactPermissionResponse(BaseModel):
    id: UUID
    matter_id: UUID
    matter_title: str
    client_contact_id: UUID
    contact_name: str
    contact_email: str
    permission_level: ContactPermissionLevel
    created_at: datetime
    updated_at: datetime