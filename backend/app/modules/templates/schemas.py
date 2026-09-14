from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field


class TemplateResponse(BaseModel):
    id: UUID
    org_id: UUID
    title: str
    description: str | None
    category: str
    original_filename: str
    content_type: str
    version: int
    body: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class TemplateDownloadResponse(BaseModel):
    download_url: str
    expires_in_seconds: int


class UpdateTemplateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    body: str | None = Field(default=None, max_length=20000)