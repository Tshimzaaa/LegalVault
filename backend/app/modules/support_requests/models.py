from datetime import date
from uuid import UUID

from sqlalchemy import Date, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column
from typing import TYPE_CHECKING
import enum

from app.database.base import BaseModel

if TYPE_CHECKING:
    from app.modules.auth.models.law_firm import LawFirm
    from app.modules.clients.models import Client, ClientContact


class SupportRequestType(str, enum.Enum):
    NDA = "nda"
    CONSULTANCY = "consultancy"
    SUPPLIER = "supplier"
    GENERAL = "general"


class SupportRequestPriority(str, enum.Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class SupportRequestStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"


class SupportRequest(BaseModel):
    __tablename__ = "support_requests"

    firm_id: Mapped[UUID] = mapped_column(
        ForeignKey("law_firms.id"),
        nullable=False,
    )

    client_id: Mapped[UUID] = mapped_column(
        ForeignKey("clients.id"),
        nullable=False,
    )

    contact_id: Mapped[UUID] = mapped_column(
        ForeignKey("client_contacts.id"),
        nullable=False,
    )

    request_type: Mapped[SupportRequestType] = mapped_column(
        Enum(SupportRequestType),
        nullable=False,
    )

    counterparty: Mapped[str | None] = mapped_column(String(200), nullable=True)

    priority: Mapped[SupportRequestPriority] = mapped_column(
        Enum(SupportRequestPriority),
        default=SupportRequestPriority.MEDIUM,
        nullable=False,
    )

    needed_by: Mapped[date | None] = mapped_column(Date, nullable=True)

    description: Mapped[str] = mapped_column(Text, nullable=False)

    reference_documents: Mapped[str | None] = mapped_column(String(500), nullable=True)

    status: Mapped[SupportRequestStatus] = mapped_column(
        Enum(SupportRequestStatus),
        default=SupportRequestStatus.OPEN,
        nullable=False,
    )
