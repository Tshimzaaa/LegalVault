from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime

from app.modules.auth.models.role import UserRole

class UserResponse(BaseModel):
    id: UUID
    firm_id: UUID
    first_name: str
    last_name: str
    email: EmailStr
    role: UserRole
    is_active: bool
    last_login: datetime | None = None

    class Config:
        from_attributes = True
        # password_hash intentionally excluded — never serialize it