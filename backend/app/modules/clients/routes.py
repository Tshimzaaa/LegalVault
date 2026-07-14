from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from fastapi import Request
from app.core.limiter import limiter
from app.database.session import get_db
from app.modules.clients.schemas import (
    CreateClientRequest,
    ClientResponse,
    InviteContactRequest,
    ContactResponse,
    AcceptInviteRequest,
    ClientLoginRequest,
    ClientTokenResponse,
    ResendInviteRequest,
)
from app.modules.clients.service import ClientService
from app.modules.clients.dependencies import get_current_contact
from app.modules.clients.models import ClientContact

from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User

router = APIRouter(prefix="/clients", tags=["clients"])
client_auth_router = APIRouter(prefix="/client-auth", tags=["client-auth"])


# --- Staff-facing routes (require staff login) ---
@client_auth_router.post("/login", response_model=ClientTokenResponse)
@limiter.limit("5/minute")
def client_login(request: Request, credentials: ClientLoginRequest, db: Session = Depends(get_db)):
    service = ClientService(db)
    return service.login(credentials)
@router.post("", response_model=ClientResponse, status_code=201)
def create_client(
    request: CreateClientRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ClientService(db)
    return service.create_client(current_user.firm_id, request)


@router.post("/{client_id}/contacts", response_model=ContactResponse, status_code=201)
def invite_contact(
    client_id: str,
    request: InviteContactRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ClientService(db)
    return service.invite_contact(client_id, request, staff_firm_id=current_user.firm_id)


# --- Client-facing (portal) routes ---

@client_auth_router.post("/accept-invite", response_model=ContactResponse)
def accept_invite(request: AcceptInviteRequest, db: Session = Depends(get_db)):
    service = ClientService(db)
    return service.accept_invite(request)


@client_auth_router.post("/login", response_model=ClientTokenResponse)
def client_login(request: ClientLoginRequest, db: Session = Depends(get_db)):
    service = ClientService(db)
    return service.login(request)


@client_auth_router.get("/me", response_model=ContactResponse)
def get_me(current_contact: ClientContact = Depends(get_current_contact)):
    return current_contact
@router.get("", response_model=list[ClientResponse])
def list_clients(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ClientService(db)
    return service.list_clients(current_user.firm_id)
@router.post("/contacts/resend-invite", status_code=200)
def resend_invite(
    request: ResendInviteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ClientService(db)
    service.resend_invite(request.email, current_user.firm_id)
    return {"message": "Invitation resent."}