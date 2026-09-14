from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field


class FallbackClauseResponse(BaseModel):
    id: UUID
    org_id: UUID
    name: str
    category: str
    description: str
    content: str
    pre_approved: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CreateFallbackClauseRequest(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    category: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1, max_length=500)
    content: str = Field(min_length=1, max_length=20000)
    pre_approved: bool = True


class UpdateFallbackClauseRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=200)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, min_length=1, max_length=500)
    content: str | None = Field(default=None, min_length=1, max_length=20000)
    pre_approved: bool | None = None
