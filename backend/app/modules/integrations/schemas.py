from datetime import datetime
from pydantic import BaseModel, Field

from app.modules.integrations.models import IntegrationProvider


class ConfigureIntegrationRequest(BaseModel):
    credentials: dict[str, str] = Field(default_factory=dict)
    is_enabled: bool = True


class IntegrationStatusResponse(BaseModel):
    provider: IntegrationProvider
    is_enabled: bool
    is_configured: bool
    connected_at: datetime | None

    # Deliberately no credentials / encrypted_credentials field — nothing ever
    # echoes stored credentials back in any response.
