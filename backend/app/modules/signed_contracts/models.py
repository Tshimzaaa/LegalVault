from datetime import date
from uuid import UUID

from sqlalchemy import Date, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column
from typing import TYPE_CHECKING
import enum

from app.database.base import BaseModel

if TYPE_CHECKING:
    from app.modules.auth.models.law_firm import LawFirm
    from app.modules.clients.models import Client
    from app.modules.matters.models import Matter


class ContractType(str, enum.Enum):
    NDA = "nda"
    CONSULTANCY = "consultancy"
    SUPPLIER = "supplier"
    GENERAL = "general"


class ContractStatus(str, enum.Enum):
    ACTIVE = "active"
    ARCHIVED = "archived"


class SignedContract(BaseModel):
    __tablename__ = "signed_contracts"

    firm_id: Mapped[UUID] = mapped_column(
        ForeignKey("law_firms.id"),
        nullable=False,
        index=True,
    )

    client_id: Mapped[UUID] = mapped_column(
        ForeignKey("clients.id"),
        nullable=False,
        index=True,
    )

    # Optional traceability back to the matter this contract was signed under —
    # nullable because contracts can also be imported wholesale from an external tool.
    matter_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("matters.id"),
        nullable=True,
        index=True,
    )

    uploaded_by: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)

    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    agreement_type: Mapped[ContractType] = mapped_column(
        Enum(ContractType),
        nullable=False,
    )

    signed_date: Mapped[date] = mapped_column(Date, nullable=False)

    # When the agreement lapses, if it has a fixed term — null means no fixed end date (e.g. a perpetual NDA).
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Where this record came from — free text (e.g. "signinghub", "trackado", "manual") rather than a
    # rigid enum, since new e-signature vendors get added over time and this is display-only metadata.
    integration_source: Mapped[str] = mapped_column(String(50), nullable=False, default="manual")

    # Only ACTIVE/ARCHIVED are persisted — "expiring soon" is derived from expiry_date at read time,
    # so it can never drift out of sync with the actual date.
    status: Mapped[ContractStatus] = mapped_column(
        Enum(ContractStatus),
        default=ContractStatus.ACTIVE,
        nullable=False,
        index=True,
    )

    file_key: Mapped[str] = mapped_column(String(500), nullable=False)

    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)

    content_type: Mapped[str] = mapped_column(String(100), nullable=False)
