from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING
import enum

from app.database.base import BaseModel
from app.modules.notifications.models import RecipientType

if TYPE_CHECKING:
    from app.modules.auth.models.organization import Organization
    from app.modules.clients.models import Client
    from app.modules.matters.models import Matter, MatterDocument
    from app.modules.signed_contracts.models import SignedContract


class SignatureRequestStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    DECLINED = "declined"
    VOIDED = "voided"


class SignatureRecipientStatus(str, enum.Enum):
    PENDING = "pending"
    SIGNED = "signed"
    DECLINED = "declined"


class SignatureRequest(BaseModel):
    __tablename__ = "signature_requests"

    org_id: Mapped[UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False, index=True)

    matter_id: Mapped[UUID] = mapped_column(ForeignKey("matters.id"), nullable=False, index=True)

    client_id: Mapped[UUID] = mapped_column(ForeignKey("clients.id"), nullable=False, index=True)

    source_document_id: Mapped[UUID] = mapped_column(ForeignKey("matter_documents.id"), nullable=False)

    requested_by: Mapped[UUID] = mapped_column(ForeignKey("users.id"), nullable=False)

    title: Mapped[str] = mapped_column(String(200), nullable=False)

    status: Mapped[SignatureRequestStatus] = mapped_column(
        Enum(SignatureRequestStatus),
        default=SignatureRequestStatus.PENDING,
        nullable=False,
    )

    # Documenso's own document id — used to correlate incoming webhook events back to
    # this row. Stored as text since Documenso's ids are numeric but opaque to us.
    documenso_document_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Set once every recipient has signed and the final PDF has been archived as a
    # SignedContract (see app/modules/signatures/service.py's webhook handling).
    signed_contract_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("signed_contracts.id"), nullable=True
    )

    recipients: Mapped[list["SignatureRecipient"]] = relationship(
        "SignatureRecipient",
        back_populates="signature_request",
        order_by="SignatureRecipient.signing_order",
    )


class SignatureRecipient(BaseModel):
    __tablename__ = "signature_recipients"

    signature_request_id: Mapped[UUID] = mapped_column(
        ForeignKey("signature_requests.id"), nullable=False, index=True
    )

    # Not a ForeignKey — a recipient can be a staff user or a client contact (two
    # different tables), same pattern as Notification.recipient_type/recipient_id.
    recipient_type: Mapped[RecipientType] = mapped_column(Enum(RecipientType), nullable=False)

    recipient_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False, index=True)

    name: Mapped[str] = mapped_column(String(200), nullable=False)

    email: Mapped[str] = mapped_column(String(255), nullable=False)

    signing_order: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    status: Mapped[SignatureRecipientStatus] = mapped_column(
        Enum(SignatureRecipientStatus),
        default=SignatureRecipientStatus.PENDING,
        nullable=False,
    )

    # Documenso's per-recipient signing link — surfaced in the UI as "Sign now".
    signing_url: Mapped[str] = mapped_column(String(1000), nullable=False)

    documenso_recipient_id: Mapped[str] = mapped_column(String(100), nullable=False)

    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    signature_request: Mapped["SignatureRequest"] = relationship(
        "SignatureRequest",
        back_populates="recipients",
    )
