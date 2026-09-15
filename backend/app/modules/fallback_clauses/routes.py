from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.modules.fallback_clauses.schemas import (
    FallbackClauseResponse,
    CreateFallbackClauseRequest,
    UpdateFallbackClauseRequest,
)
from app.modules.fallback_clauses.service import FallbackClauseService

from app.modules.auth.dependencies import get_current_user, require_role
from app.modules.auth.models import User
from app.modules.auth.models.role import UserRole

router = APIRouter(prefix="/fallback-clauses", tags=["fallback-clauses"])


@router.post("", response_model=FallbackClauseResponse, status_code=201)
def create_fallback_clause(
    request: CreateFallbackClauseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.LAWYER])),
):
    service = FallbackClauseService(db)
    return service.create_clause(current_user.org_id, current_user.id, request)


@router.get("", response_model=list[FallbackClauseResponse])
def list_fallback_clauses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = FallbackClauseService(db)
    return service.list_clauses(current_user.org_id)


@router.patch("/{clause_id}", response_model=FallbackClauseResponse)
def update_fallback_clause(
    clause_id: str,
    request: UpdateFallbackClauseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.LAWYER])),
):
    service = FallbackClauseService(db)
    return service.update_clause(clause_id, current_user.org_id, current_user.id, request)


@router.delete("/{clause_id}", status_code=204)
def delete_fallback_clause(
    clause_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    service = FallbackClauseService(db)
    service.delete_clause(clause_id, current_user.org_id, current_user.id)
