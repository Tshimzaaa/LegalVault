import json
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.modules.integrations.repository import IntegrationRepository
from app.modules.integrations.models import OrganizationIntegration, IntegrationProvider
from app.modules.integrations.schemas import ConfigureIntegrationRequest, IntegrationStatusResponse
from app.core.encryption import encrypt
from app.modules.audit.service import AuditService
from app.modules.audit.models import ActorType
from app.modules.audit import actions as audit_actions


class IntegrationService:

    def __init__(self, db: Session):
        self.db = db
        self.repository = IntegrationRepository(db)
        self.audit = AuditService(db)

    def _to_status(self, org_id, provider: IntegrationProvider) -> IntegrationStatusResponse:
        row = self.repository.get(org_id, provider)
        if not row:
            return IntegrationStatusResponse(
                provider=provider, is_enabled=False, is_configured=False, connected_at=None
            )
        return IntegrationStatusResponse(
            provider=provider,
            is_enabled=row.is_enabled,
            is_configured=row.encrypted_credentials is not None,
            connected_at=row.connected_at,
        )

    def list_for_org(self, org_id) -> list[IntegrationStatusResponse]:
        return [self._to_status(org_id, provider) for provider in IntegrationProvider]

    def configure(
        self, org_id, actor_id, provider: IntegrationProvider, request: ConfigureIntegrationRequest
    ) -> IntegrationStatusResponse:
        row = self.repository.get(org_id, provider)
        if not row:
            row = OrganizationIntegration(org_id=org_id, provider=provider)
            self.repository.create(row)

        row.encrypted_credentials = encrypt(json.dumps(request.credentials))
        row.is_enabled = request.is_enabled
        row.configured_by = actor_id
        row.connected_at = datetime.now(timezone.utc)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.INTEGRATION_CONFIGURED,
            target_type="org_integration",
            target_id=row.id,
            details={"provider": provider.value, "is_enabled": row.is_enabled},
        )
        self.db.commit()
        return self._to_status(org_id, provider)

    def disable(self, org_id, actor_id, provider: IntegrationProvider) -> IntegrationStatusResponse:
        row = self.repository.get(org_id, provider)
        if row:
            row.is_enabled = False
            self.audit.log(
                actor_type=ActorType.STAFF,
                actor_id=actor_id,
                org_id=org_id,
                action=audit_actions.INTEGRATION_DISABLED,
                target_type="org_integration",
                target_id=row.id,
                details={"provider": provider.value},
            )
            self.db.commit()
        return self._to_status(org_id, provider)

    def disconnect(self, org_id, actor_id, provider: IntegrationProvider) -> IntegrationStatusResponse:
        row = self.repository.get(org_id, provider)
        if row:
            row.encrypted_credentials = None
            row.is_enabled = False
            row.connected_at = None
            self.audit.log(
                actor_type=ActorType.STAFF,
                actor_id=actor_id,
                org_id=org_id,
                action=audit_actions.INTEGRATION_DISCONNECTED,
                target_type="org_integration",
                target_id=row.id,
                details={"provider": provider.value},
            )
            self.db.commit()
        return self._to_status(org_id, provider)
