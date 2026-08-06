from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field

from app.modules.announcements.models import AnnouncementSeverity


class CreateAnnouncementRequest(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    body: str = Field(min_length=1)
    severity: AnnouncementSeverity = AnnouncementSeverity.INFO
    is_active: bool = True


class UpdateAnnouncementRequest(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    body: str | None = Field(default=None, min_length=1)
    severity: AnnouncementSeverity | None = None
    is_active: bool | None = None


class AnnouncementResponse(BaseModel):
    id: UUID
    title: str
    body: str
    severity: AnnouncementSeverity
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
