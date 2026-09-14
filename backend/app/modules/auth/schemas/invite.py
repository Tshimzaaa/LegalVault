from pydantic import BaseModel, EmailStr, Field
from app.modules.auth.models.role import UserRole
from app.modules.auth.schemas.user import UserResponse


class InviteStaffRequest(BaseModel):
    first_name: str = Field(min_length=2, max_length=100)
    last_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    role: UserRole


class InviteStaffResponse(UserResponse):
    # Only ever returned to the admin who just created the invite — not exposed via
    # the general staff-list endpoint, since any org member could otherwise hijack
    # a pending invite meant for someone else.
    invitation_token: str | None = None


class AcceptStaffInviteRequest(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)