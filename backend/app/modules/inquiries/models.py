import enum
from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, Enum, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import BaseModel


class InquiryKind(str, enum.Enum):
    CONTACT = "contact"
    ACCESS_REQUEST = "access_request"


class InquiryStatus(str, enum.Enum):
    NEW = "new"
    IN_PROGRESS = "in_progress"
    ONBOARDED = "onboarded"
    CLOSED = "closed"


class Inquiry(BaseModel):
    """A message from the public site: a general contact form or a request for an account.

    Platform-level, like announcements: it belongs to no organization and is only
    ever read through the owner console.
    """

    __tablename__ = "inquiries"

    kind: Mapped[InquiryKind] = mapped_column(Enum(InquiryKind), nullable=False)
    status: Mapped[InquiryStatus] = mapped_column(
        Enum(InquiryStatus), default=InquiryStatus.NEW, nullable=False
    )

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    organization_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)

    owner_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    handled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    organization_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
