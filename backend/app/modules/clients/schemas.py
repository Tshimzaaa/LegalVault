from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field


# --- Client (company) schemas ---

class CreateClientRequest(BaseModel):
    company_name: str = Field(min_length=2, max_length=150)


class ClientResponse(BaseModel):
    id: UUID
    firm_id: UUID
    company_name: str
    is_active: bool

    class Config:
        from_attributes = True


# --- Client contact (individual login) schemas ---

class InviteContactRequest(BaseModel):
    first_name: str = Field(min_length=2, max_length=100)
    last_name: str = Field(min_length=2, max_length=100)
    email: EmailStr


class ContactResponse(BaseModel):
    id: UUID
    client_id: UUID
    first_name: str
    last_name: str
    email: EmailStr
    is_active: bool
    invitation_status: str
    last_login: datetime | None = None

    class Config:
        from_attributes = True
        # password_hash and invitation_token intentionally excluded


class AcceptInviteRequest(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=128)


class ClientLoginRequest(BaseModel):
    email: EmailStr
    password: str

class ClientTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    
class ResendInviteRequest(BaseModel):
    email: EmailStr

class ClientForgotPasswordRequest(BaseModel):
    email: EmailStr

class ClientResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)