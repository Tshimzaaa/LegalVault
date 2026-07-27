from pydantic import BaseModel, EmailStr, Field
from app.modules.auth.models.role import UserRole


class InviteStaffRequest(BaseModel):
    first_name: str = Field(min_length=2, max_length=100)
    last_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    role: UserRole


class AcceptStaffInviteRequest(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)