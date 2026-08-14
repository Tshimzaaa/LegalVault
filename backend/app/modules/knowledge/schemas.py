from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, Field


class CreateKnowledgeArticleRequest(BaseModel):
    title: str = Field(min_length=2, max_length=200)
    category: str = Field(min_length=1, max_length=100)
    content: str = Field(min_length=1)
    is_published: bool = False


class UpdateKnowledgeArticleRequest(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=200)
    category: str | None = Field(default=None, min_length=1, max_length=100)
    content: str | None = Field(default=None, min_length=1)
    is_published: bool | None = None


class KnowledgeArticleResponse(BaseModel):
    id: UUID
    firm_id: UUID
    title: str
    category: str
    content: str
    is_published: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
