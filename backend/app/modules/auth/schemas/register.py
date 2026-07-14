from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.core.constants import (
    ADDRESS_MAX_LENGTH,
    FIRST_NAME_MAX_LENGTH,
    LAST_NAME_MAX_LENGTH,
    NAME_MAX_LENGTH,
    PASSWORD_MAX_LENGTH,
    PHONE_MAX_LENGTH,
    URL_MAX_LENGTH,
)


class RegisterLawFirmRequest(BaseModel):
    name: str = Field(
        min_length=2,
        max_length=NAME_MAX_LENGTH,
    )

    email: EmailStr

    phone: str | None = Field(
        default=None,
        max_length=PHONE_MAX_LENGTH,
    )

    website: str | None = Field(
        default=None,
        max_length=URL_MAX_LENGTH,
    )

    address: str | None = Field(
        default=None,
        max_length=ADDRESS_MAX_LENGTH,
    )


class RegisterAdminRequest(BaseModel):
    first_name: str = Field(
        min_length=2,
        max_length=FIRST_NAME_MAX_LENGTH,
    )

    last_name: str = Field(
        min_length=2,
        max_length=LAST_NAME_MAX_LENGTH,
    )

    email: EmailStr

    password: str = Field(
        min_length=8,
        max_length=PASSWORD_MAX_LENGTH,
    )


class RegisterRequest(BaseModel):
    admin_secret: str
    law_firm: RegisterLawFirmRequest
    admin: RegisterAdminRequest


class RegisterResponse(BaseModel):
    message: str
    law_firm_id: UUID
    user_id: UUID
    access_token: str
    token_type: str = "bearer"