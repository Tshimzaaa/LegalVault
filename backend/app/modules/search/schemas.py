from uuid import UUID
from pydantic import BaseModel


class SearchResultItem(BaseModel):
    id: UUID
    title: str
    subtitle: str | None = None


class SearchResponse(BaseModel):
    matters: list[SearchResultItem]
    staff: list[SearchResultItem]
    documents: list[SearchResultItem]
