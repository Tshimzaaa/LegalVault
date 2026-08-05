from uuid import UUID
from datetime import datetime
from pydantic import BaseModel

from app.modules.audit.models import ActorType


class AuditLogResponse(BaseModel):
    id: UUID
    actor_type: ActorType
    actor_id: UUID | None
    firm_id: UUID | None
    action: str
    target_type: str
    target_id: UUID | None
    details: dict | None
    created_at: datetime

    class Config:
        from_attributes = True
