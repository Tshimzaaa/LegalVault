from uuid import UUID
from datetime import datetime
from pydantic import BaseModel


class TemplateResponse(BaseModel):
    id: UUID
    firm_id: UUID
    title: str
    description: str | None
    category: str
    original_filename: str
    content_type: str
    created_at: datetime

    class Config:
        from_attributes = True


class TemplateDownloadResponse(BaseModel):
    download_url: str
    expires_in_seconds: int