from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field


class MessageResponse(BaseModel):
    id: UUID
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationSummaryResponse(BaseModel):
    id: UUID
    title: str
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationDetailResponse(BaseModel):
    id: UUID
    title: str
    created_at: datetime
    messages: list[MessageResponse]

    class Config:
        from_attributes = True


class SendMessageRequest(BaseModel):
    conversation_id: UUID | None = None
    content: str = Field(min_length=1, max_length=4000)
