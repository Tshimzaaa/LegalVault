from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.clients.dependencies import get_current_contact
from app.modules.clients.models import ClientContact
from app.modules.support_requests.schemas import (
    CreateSupportRequestRequest,
    UpdateSupportRequestStatusRequest,
    SupportRequestResponse,
)
from app.modules.support_requests.service import SupportRequestService

router = APIRouter(prefix="/support-requests", tags=["support-requests"])
client_support_requests_router = APIRouter(prefix="/client-support-requests", tags=["client-support-requests"])


@client_support_requests_router.post("", response_model=SupportRequestResponse, status_code=201)
def create_support_request(
    request: CreateSupportRequestRequest,
    db: Session = Depends(get_db),
    current_contact: ClientContact = Depends(get_current_contact),
):
    service = SupportRequestService(db)
    return service.create_support_request(
        firm_id=current_contact.client.firm_id,
        client_id=current_contact.client_id,
        contact_id=current_contact.id,
        request=request,
    )


@client_support_requests_router.get("", response_model=list[SupportRequestResponse])
def list_my_support_requests(
    db: Session = Depends(get_db),
    current_contact: ClientContact = Depends(get_current_contact),
):
    service = SupportRequestService(db)
    return service.list_my_support_requests(current_contact.id)


@router.get("", response_model=list[SupportRequestResponse])
def list_support_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = SupportRequestService(db)
    return service.list_support_requests_for_firm(current_user.firm_id)


@router.patch("/{support_request_id}/status", response_model=SupportRequestResponse)
def update_support_request_status(
    support_request_id: str,
    request: UpdateSupportRequestStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = SupportRequestService(db)
    return service.update_status(support_request_id, current_user.firm_id, request)
