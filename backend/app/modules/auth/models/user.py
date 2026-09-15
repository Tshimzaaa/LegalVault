from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Enum, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import (
    EMAIL_MAX_LENGTH,
    FIRST_NAME_MAX_LENGTH,
    LAST_NAME_MAX_LENGTH,
    PASSWORD_HASH_MAX_LENGTH,
)
from app.database.base import BaseModel

from .role import UserRole
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .organization import Organization

class User(BaseModel):
    __tablename__ = "users"

    org_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )

    first_name: Mapped[str] = mapped_column(
        String(FIRST_NAME_MAX_LENGTH),
        nullable=False,
    )

    last_name: Mapped[str] = mapped_column(
        String(LAST_NAME_MAX_LENGTH),
        nullable=False,
    )

    email: Mapped[str] = mapped_column(
        String(EMAIL_MAX_LENGTH),
        unique=True,
        index=True,
        nullable=False,
    )

    password_hash: Mapped[str | None] = mapped_column(
        String(PASSWORD_HASH_MAX_LENGTH),
        nullable=True,
    )

    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole),
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    last_login: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    organization: Mapped["Organization"] = relationship(
        "Organization",
        back_populates="users",
    )
    reset_token: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True,
    )

    reset_token_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    tokens_invalid_before: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    invitation_status: Mapped[str] = mapped_column(
        String(20),
        default="accepted",
        nullable=False,
    )

    invitation_token: Mapped[str | None] = mapped_column(
        String(255),
        unique=True,
        nullable=True,
    )

    invitation_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Self-reported weekly working-hours capacity, set by an admin — backs the Resource
    # Planning utilization view (reporting/service.py). Null means "not configured yet",
    # distinct from 0, so the frontend can show "Not set" instead of a false 100%+ overload.
    weekly_capacity_hours: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )