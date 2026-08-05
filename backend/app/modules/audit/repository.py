from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.audit.models import AuditLog


class AuditLogRepository:

    def __init__(self, db: Session):
        self.db = db

    def create(self, entry: AuditLog) -> AuditLog:
        self.db.add(entry)
        self.db.flush()
        return entry

    def list_for_firm(self, firm_id, limit: int, offset: int) -> list[AuditLog]:
        statement = (
            select(AuditLog)
            .where(AuditLog.firm_id == firm_id)
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(self.db.scalars(statement))

    def list_all(self, limit: int, offset: int, firm_id=None) -> list[AuditLog]:
        statement = select(AuditLog).order_by(AuditLog.created_at.desc())
        if firm_id is not None:
            statement = statement.where(AuditLog.firm_id == firm_id)
        statement = statement.limit(limit).offset(offset)
        return list(self.db.scalars(statement))
