from uuid import UUID

from sqlalchemy import Enum, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column
import enum

from app.database.base import BaseModel


class ActorType(str, enum.Enum):
    STAFF = "staff"
    OWNER = "owner"


class AuditLog(BaseModel):
    __tablename__ = "audit_logs"

    actor_type: Mapped[ActorType] = mapped_column(
        Enum(ActorType),
        nullable=False,
    )

    # Intentionally not a ForeignKey — audit rows must outlive the actor/firm/target
    # they reference (e.g. a firm-deletion entry has to remain readable after the
    # firm row is gone). `details` carries a snapshot for that case.
    actor_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        nullable=True,
    )

    firm_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        nullable=True,
        index=True,
    )

    action: Mapped[str] = mapped_column(String(50), nullable=False)

    target_type: Mapped[str] = mapped_column(String(50), nullable=False)

    target_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True),
        nullable=True,
    )

    details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
