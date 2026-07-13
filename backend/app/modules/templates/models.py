from uuid import UUID
from sqlalchemy import String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from typing import TYPE_CHECKING

from app.database.base import BaseModel

if TYPE_CHECKING:
    from app.modules.auth.models.law_firm import LawFirm


class Template(BaseModel):
    __tablename__ = "templates"

    firm_id: Mapped[UUID] = mapped_column(
        ForeignKey("law_firms.id"),
        nullable=False,
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)

    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    category: Mapped[str] = mapped_column(String(100), nullable=False)

    file_key: Mapped[str] = mapped_column(String(500), nullable=False)
    # file_key is the path/identifier used to locate the file in R2 — not the file itself

    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)

    content_type: Mapped[str] = mapped_column(String(100), nullable=False)