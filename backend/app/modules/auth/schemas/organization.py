from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.core.constants import (
    ADDRESS_MAX_LENGTH,
    NAME_MAX_LENGTH,
    PHONE_MAX_LENGTH,
    URL_MAX_LENGTH,
)


class OrganizationProfileResponse(BaseModel):
    id: UUID
    name: str
    email: str
    phone: str | None
    website: str | None
    address: str | None
    is_active: bool

    class Config:
        from_attributes = True


class UpdateOrganizationProfileRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=NAME_MAX_LENGTH)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=PHONE_MAX_LENGTH)
    website: str | None = Field(default=None, max_length=URL_MAX_LENGTH)
    address: str | None = Field(default=None, max_length=ADDRESS_MAX_LENGTH)
