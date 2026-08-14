from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.integrations.models import FirmIntegration, IntegrationProvider


class IntegrationRepository:

    def __init__(self, db: Session):
        self.db = db

    def get(self, firm_id, provider: IntegrationProvider) -> FirmIntegration | None:
        return self.db.scalar(
            select(FirmIntegration).where(
                FirmIntegration.firm_id == firm_id,
                FirmIntegration.provider == provider,
            )
        )

    def list_by_firm(self, firm_id) -> list[FirmIntegration]:
        return list(self.db.scalars(select(FirmIntegration).where(FirmIntegration.firm_id == firm_id)))

    def create(self, integration: FirmIntegration) -> FirmIntegration:
        self.db.add(integration)
        self.db.flush()
        return integration
