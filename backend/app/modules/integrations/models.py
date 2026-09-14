from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from typing import TYPE_CHECKING
import enum

from app.database.base import BaseModel

if TYPE_CHECKING:
    from app.modules.auth.models.organization import Organization


class IntegrationProvider(str, enum.Enum):
    SIGNINGHUB = "signinghub"
    TRACKADO = "trackado"
    CONTRACT_EXPRESS = "contract_express"
    CLOUD_STORAGE = "cloud_storage"


class OrganizationIntegration(BaseModel):
    __tablename__ = "org_integrations"
    __table_args__ = (UniqueConstraint("org_id", "provider", name="uq_org_integrations_org_provider"),)

    org_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )

    provider: Mapped[IntegrationProvider] = mapped_column(Enum(IntegrationProvider), nullable=False)

    is_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Fernet ciphertext of a JSON-serialized dict[str, str] (e.g. {"api_key": "..."}).
    # Never decrypted by any route response — see app/modules/integrations/service.py.
    encrypted_credentials: Mapped[str | None] = mapped_column(Text, nullable=True)

    configured_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)

    connected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
