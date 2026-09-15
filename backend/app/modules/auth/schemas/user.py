from pydantic import BaseModel, EmailStr, Field
from uuid import UUID
from datetime import datetime

from app.modules.auth.models.role import UserRole

class UserResponse(BaseModel):
    id: UUID
    org_id: UUID
    first_name: str
    last_name: str
    email: EmailStr
    role: UserRole
    is_active: bool
    invitation_status: str
    last_login: datetime | None = None
    weekly_capacity_hours: float | None = None

    class Config:
        from_attributes = True
        # password_hash intentionally excluded — never serialize it

class UpdateStaffStatusRequest(BaseModel):
    is_active: bool

class UpdateStaffCapacityRequest(BaseModel):
    weekly_capacity_hours: float | None = Field(default=None, ge=0, le=168)