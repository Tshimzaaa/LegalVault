from uuid import UUID
import enum

from sqlalchemy import Boolean, Enum, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import BaseModel


class RecipientType(str, enum.Enum):
    STAFF = "staff"


class Notification(BaseModel):
    __tablename__ = "notifications"

    # Not a ForeignKey — kept loose so a notification never blocks deleting the
    # recipient it points at.
    recipient_type: Mapped[RecipientType] = mapped_column(Enum(RecipientType), nullable=False)

    recipient_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)

    type: Mapped[str] = mapped_column(String(50), nullable=False)

    title: Mapped[str] = mapped_column(String(200), nullable=False)

    body: Mapped[str] = mapped_column(Text, nullable=False)

    # Not a ForeignKey — the target (a matter, etc.) may belong to any entity type;
    # kept loose so a notification never blocks deletion of the thing it refers to.
    target_type: Mapped[str | None] = mapped_column(String(50), nullable=True)

    target_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
