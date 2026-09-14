from sqlalchemy.orm import Session

from app.modules.audit.models import AuditLog, ActorType
from app.modules.audit.repository import AuditLogRepository


class AuditService:

    def __init__(self, db: Session):
        self.db = db
        self.repository = AuditLogRepository(db)

    def log(
        self,
        actor_type: ActorType,
        actor_id,
        org_id,
        action: str,
        target_type: str,
        target_id=None,
        details: dict | None = None,
    ) -> AuditLog:
        entry = AuditLog(
            actor_type=actor_type,
            actor_id=actor_id,
            org_id=org_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details,
        )
        return self.repository.create(entry)
