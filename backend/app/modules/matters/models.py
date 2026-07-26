from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING
import enum

from app.database.base import BaseModel

if TYPE_CHECKING:
    from app.modules.auth.models.law_firm import LawFirm
    from app.modules.clients.models import Client
    from app.modules.auth.models.user import User


class MatterStatus(str, enum.Enum):
    INTAKE = "intake"
    IN_REVIEW = "in_review"
    AWAITING_SIGNATURE = "awaiting_signature"
    SIGNED = "signed"
    CLOSED = "closed"
    DECLINED = "declined"


class MatterRole(str, enum.Enum):
    LEAD_LAWYER = "lead_lawyer"
    PARALEGAL = "paralegal"
    SECRETARY = "secretary"
    REVIEWER = "reviewer"


class Matter(BaseModel):
    __tablename__ = "matters"

    firm_id: Mapped[UUID] = mapped_column(
        ForeignKey("law_firms.id"),
        nullable=False,
    )

    client_id: Mapped[UUID] = mapped_column(
        ForeignKey("clients.id"),
        nullable=False,
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)

    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[MatterStatus] = mapped_column(
        Enum(MatterStatus),
        default=MatterStatus.INTAKE,
        nullable=False,
    )

    is_visible_to_client: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    assignments: Mapped[list["MatterAssignment"]] = relationship(
        "MatterAssignment",
        back_populates="matter",
    )


class MatterAssignment(BaseModel):
    __tablename__ = "matter_assignments"

    matter_id: Mapped[UUID] = mapped_column(
        ForeignKey("matters.id"),
        nullable=False,
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
    )

    role_on_matter: Mapped[MatterRole] = mapped_column(
        Enum(MatterRole),
        nullable=False,
    )

    matter: Mapped["Matter"] = relationship(
        "Matter",
        back_populates="assignments",
    )