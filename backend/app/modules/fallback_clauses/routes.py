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
from app.modules.clients.dependencies import get_current_contact
from app.modules.clients.models import ClientContact
from app.modules.clients.repository import ClientRepository
from app.exceptions.clients import ClientNotFound

router = APIRouter(prefix="/fallback-clauses", tags=["fallback-clauses"])
client_fallback_clauses_router = APIRouter(prefix="/client-fallback-clauses", tags=["client-fallback-clauses"])


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


def _get_org_id_for_contact(contact: ClientContact, db: Session) -> str:
    client_repo = ClientRepository(db)
    client = client_repo.get_client_by_id(contact.client_id)
    if not client:
        raise ClientNotFound()
    return client.org_id


@client_fallback_clauses_router.get("", response_model=list[FallbackClauseResponse])
def list_client_fallback_clauses(
    db: Session = Depends(get_db),
    current_contact: ClientContact = Depends(get_current_contact),
):
    org_id = _get_org_id_for_contact(current_contact, db)
    service = FallbackClauseService(db)
    return service.list_clauses(org_id)
