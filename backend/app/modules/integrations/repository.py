from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.integrations.models import OrganizationIntegration, IntegrationProvider


class IntegrationRepository:

    def __init__(self, db: Session):
        self.db = db

    def get(self, org_id, provider: IntegrationProvider) -> OrganizationIntegration | None:
        return self.db.scalar(
            select(OrganizationIntegration).where(
                OrganizationIntegration.org_id == org_id,
                OrganizationIntegration.provider == provider,
            )
        )

    def list_by_org(self, org_id) -> list[OrganizationIntegration]:
        return list(self.db.scalars(select(OrganizationIntegration).where(OrganizationIntegration.org_id == org_id)))

    def create(self, integration: OrganizationIntegration) -> OrganizationIntegration:
        self.db.add(integration)
        self.db.flush()
        return integration

    def delete(self, integration: OrganizationIntegration):
        self.db.delete(integration)
        self.db.flush()
