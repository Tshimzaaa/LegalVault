from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import (
    ADDRESS_MAX_LENGTH,
    EMAIL_MAX_LENGTH,
    NAME_MAX_LENGTH,
    PHONE_MAX_LENGTH,
    URL_MAX_LENGTH,
)
from app.database.base import BaseModel

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .user import User

class Organization(BaseModel):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(
        String(NAME_MAX_LENGTH),
        nullable=False,
    )

    email: Mapped[str] = mapped_column(
        String(EMAIL_MAX_LENGTH),
        unique=True,
        nullable=False,
        index=True,
    )

    phone: Mapped[str | None] = mapped_column(
        String(PHONE_MAX_LENGTH),
        nullable=True,
    )

    website: Mapped[str | None] = mapped_column(
        String(URL_MAX_LENGTH),
        nullable=True,
    )

    address: Mapped[str | None] = mapped_column(
        String(ADDRESS_MAX_LENGTH),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    users: Mapped[list["User"]] = relationship(
        "User",
        back_populates="organization"
    )