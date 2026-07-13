from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field

from app.modules.matters.models import MatterStatus, MatterRole


class CreateMatterRequest(BaseModel):
    client_id: UUID
    title: str = Field(min_length=2, max_length=200)
    description: str | None = None


class UpdateMatterStatusRequest(BaseModel):
    status: MatterStatus


class UpdateMatterVisibilityRequest(BaseModel):
    is_visible_to_client: bool


class MatterResponse(BaseModel):
    id: UUID
    firm_id: UUID
    client_id: UUID
    title: str
    description: str | None
    status: MatterStatus
    is_visible_to_client: bool
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