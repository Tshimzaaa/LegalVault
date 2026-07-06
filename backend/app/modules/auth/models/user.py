from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String
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
    from .law_firm import LawFirm

class User(BaseModel):
    __tablename__ = "users"

    firm_id: Mapped[UUID] = mapped_column(
        ForeignKey("law_firms.id"),
        nullable=False,
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

    password_hash: Mapped[str] = mapped_column(
        String(PASSWORD_HASH_MAX_LENGTH),
        nullable=False,
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

    law_firm: Mapped["LawFirm"] = relationship(
    "LawFirm",
    back_populates="users",
)