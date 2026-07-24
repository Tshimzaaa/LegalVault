from pydantic import BaseModel
from uuid import UUID


class FirmSummary(BaseModel):
    id: UUID
    name: str
    email: str
    is_active: bool

    class Config:
        from_attributes = True

class FirmDetail(BaseModel):
    id: UUID
    name: str
    email: str
    phone: str | None
    website: str | None
    address: str | None
    is_active: bool
    staff_count: int
    client_count: int
    matter_count: int

class UpdateFirmStatusRequest(BaseModel):
    is_active: bool
class OwnerLoginRequest(BaseModel):
    secret: str

class OwnerTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"