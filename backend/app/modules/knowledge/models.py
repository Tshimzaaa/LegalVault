from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from typing import TYPE_CHECKING

from app.database.base import BaseModel

if TYPE_CHECKING:
    from app.modules.auth.models.organization import Organization


class KnowledgeArticle(BaseModel):
    __tablename__ = "knowledge_articles"

    org_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)

    # Plain string, not an enum — orgs define their own taxonomy (e.g. "Glossary",
    # "NDAs", "Procurement basics").
    category: Mapped[str] = mapped_column(String(100), nullable=False)

    content: Mapped[str] = mapped_column(Text, nullable=False)  # markdown

    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
