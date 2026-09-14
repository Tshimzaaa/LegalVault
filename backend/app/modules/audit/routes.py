from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.modules.auth.dependencies import require_admin
from app.modules.auth.models import User
from app.modules.audit.repository import AuditLogRepository
from app.modules.audit.schemas import AuditLogResponse

router = APIRouter(prefix="/audit-log", tags=["audit"])


@router.get("", response_model=list[AuditLogResponse])
def list_audit_log(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    repo = AuditLogRepository(db)
    return repo.list_for_org(current_user.org_id, limit, offset)
