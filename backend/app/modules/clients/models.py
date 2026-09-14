from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database.base import BaseModel
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.modules.auth.models.organization import Organization


class Client(BaseModel):
    __tablename__ = "clients"

    org_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )

    company_name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    contacts: Mapped[list["ClientContact"]] = relationship(
        "ClientContact",
        back_populates="client",
    )


class ClientContact(BaseModel):
    __tablename__ = "client_contacts"

    client_id: Mapped[UUID] = mapped_column(
        ForeignKey("clients.id"),
        nullable=False,
        index=True,
    )

    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )

    password_hash: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )

    invitation_status: Mapped[str] = mapped_column(
        String(20),
        default="pending",
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

    last_login: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    client: Mapped["Client"] = relationship(
        "Client",
        back_populates="contacts",
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