from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from typing import TYPE_CHECKING

from app.database.base import BaseModel

if TYPE_CHECKING:
    from app.modules.auth.models.organization import Organization


class FallbackClause(BaseModel):
    """A org's pre-approved fallback negotiating position for a clause type,
    surfaced to clients in the portal's "My Learned Friend" page."""

    __tablename__ = "fallback_clauses"

    org_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(200), nullable=False)

    category: Mapped[str] = mapped_column(String(100), nullable=False)

    description: Mapped[str] = mapped_column(String(500), nullable=False)

    # The actual fallback clause language, shown to the client when they ask to view it.
    content: Mapped[str] = mapped_column(Text, nullable=False)

    pre_approved: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
