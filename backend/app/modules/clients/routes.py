from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from fastapi import Request
from app.modules.clients.schemas import ClientForgotPasswordRequest, ClientResetPasswordRequest

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
    ClientRefreshTokenRequest,
    ResendInviteRequest,
    UpdateClientStatusRequest,
    UpdateContactStatusRequest,
    UpdateContactProfileRequest,
    ChangeContactPasswordRequest,
)
from app.modules.clients.service import ClientService
from app.modules.clients.dependencies import get_current_contact
from app.modules.clients.models import ClientContact

from app.modules.auth.dependencies import get_current_user, require_admin
from app.modules.auth.models import User


router = APIRouter(prefix="/clients", tags=["clients"])
client_auth_router = APIRouter(prefix="/client-auth", tags=["client-auth"])


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


@router.get("/{client_id}/contacts", response_model=list[ContactResponse])
def list_contacts(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ClientService(db)
    return service.list_contacts(client_id, current_user.firm_id)


# --- Client-facing (portal) routes ---

@client_auth_router.post("/accept-invite", response_model=ContactResponse)
def accept_invite(request: AcceptInviteRequest, db: Session = Depends(get_db)):
    service = ClientService(db)
    return service.accept_invite(request)


@client_auth_router.post("/login", response_model=ClientTokenResponse)
@limiter.limit("5/minute")
def client_login(request: Request, credentials: ClientLoginRequest, db: Session = Depends(get_db)):
    service = ClientService(db)
    return service.login(credentials)


@client_auth_router.get("/me", response_model=ContactResponse)
def get_me(current_contact: ClientContact = Depends(get_current_contact)):
    return current_contact


@client_auth_router.patch("/me", response_model=ContactResponse)
def update_me(
    request: UpdateContactProfileRequest,
    db: Session = Depends(get_db),
    current_contact: ClientContact = Depends(get_current_contact),
):
    service = ClientService(db)
    return service.update_profile(current_contact, request)


@client_auth_router.post("/me/change-password", status_code=200)
def change_my_password(
    request: ChangeContactPasswordRequest,
    db: Session = Depends(get_db),
    current_contact: ClientContact = Depends(get_current_contact),
):
    service = ClientService(db)
    service.change_password(current_contact, request)
    return {"message": "Password changed. Please log in again."}


@client_auth_router.post("/refresh", response_model=ClientTokenResponse)
def client_refresh(request: ClientRefreshTokenRequest, db: Session = Depends(get_db)):
    service = ClientService(db)
    return service.refresh_token(request.refresh_token)


@client_auth_router.post("/logout", status_code=204)
def client_logout(request: ClientRefreshTokenRequest, db: Session = Depends(get_db)):
    service = ClientService(db)
    service.logout(request.refresh_token)
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
@client_auth_router.post("/forgot-password", status_code=200)
def client_forgot_password(request: ClientForgotPasswordRequest, db: Session = Depends(get_db)):
    service = ClientService(db)
    service.request_password_reset(request.email)
    return {"message": "If that email exists, a reset link has been sent."}

@client_auth_router.post("/reset-password", status_code=200)
def client_reset_password(request: ClientResetPasswordRequest, db: Session = Depends(get_db)):
    service = ClientService(db)
    service.reset_password(request.token, request.new_password)
    return {"message": "Password reset successful."}


@router.patch("/{client_id}/status", response_model=ClientResponse)
def update_client_status(
    client_id: str,
    request: UpdateClientStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    service = ClientService(db)
    return service.update_client_status(client_id, current_user.firm_id, current_user.id, request.is_active)


@router.delete("/{client_id}", status_code=204)
def delete_client(
    client_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    service = ClientService(db)
    service.delete_client(client_id, current_user.firm_id, current_user.id)


@router.patch("/{client_id}/contacts/{contact_id}/status", response_model=ContactResponse)
def update_contact_status(
    client_id: str,
    contact_id: str,
    request: UpdateContactStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    service = ClientService(db)
    return service.update_contact_status(
        client_id, contact_id, current_user.firm_id, current_user.id, request.is_active
    )


@router.post("/{client_id}/contacts/{contact_id}/force-logout", response_model=ContactResponse)
def force_logout_contact(
    client_id: str,
    contact_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    service = ClientService(db)
    return service.force_logout_contact(client_id, contact_id, current_user.firm_id, current_user.id)


@router.delete("/{client_id}/contacts/{contact_id}", status_code=204)
def delete_contact(
    client_id: str,
    contact_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    service = ClientService(db)
    service.delete_contact(client_id, contact_id, current_user.firm_id, current_user.id)

