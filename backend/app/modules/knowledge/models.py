from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from typing import TYPE_CHECKING

from app.database.base import BaseModel

if TYPE_CHECKING:
    from app.modules.auth.models.law_firm import LawFirm


class KnowledgeArticle(BaseModel):
    __tablename__ = "knowledge_articles"

    firm_id: Mapped[UUID] = mapped_column(
        ForeignKey("law_firms.id"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)

    # Plain string, not an enum — firms define their own taxonomy (e.g. "Glossary",
    # "NDAs", "Procurement basics").
    category: Mapped[str] = mapped_column(String(100), nullable=False)

    content: Mapped[str] = mapped_column(Text, nullable=False)  # markdown

    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)
