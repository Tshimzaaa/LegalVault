from fastapi import APIRouter, HTTPException
from app.modules.owner.schemas import OwnerLoginRequest, OwnerTokenResponse
from app.core.security import create_access_token
from app.core.config import settings

from fastapi import Depends
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.modules.auth.schemas.register import RegisterLawFirmRequest, RegisterAdminRequest
from app.modules.auth.services.register import RegisterService
from app.modules.owner.dependencies import get_current_owner
from pydantic import BaseModel
from app.modules.auth.repository import AuthRepository
from app.modules.clients.repository import ClientRepository
from app.modules.matters.repository import MatterRepository
from app.modules.owner.schemas import FirmSummary, FirmDetail, UpdateFirmStatusRequest
from app.exceptions.auth import LawFirmAlreadyExists  # reuse or add a FirmNotFound exception


router = APIRouter(prefix="/owner", tags=["owner"])

class OwnerCreateFirmRequest(BaseModel):
    law_firm: RegisterLawFirmRequest
    admin: RegisterAdminRequest


@router.post("/firms", status_code=201)
def create_firm(
    request: OwnerCreateFirmRequest,
    db: Session = Depends(get_db),
    _owner=Depends(get_current_owner),
):
    service = RegisterService(db)
    # reuse existing register logic, but skip the admin_secret check since owner auth already covers it
    return service.register_as_owner(request.law_firm, request.admin)

@router.post("/login", response_model=OwnerTokenResponse)
def owner_login(request: OwnerLoginRequest):
    if request.secret != settings.REGISTER_SECRET:
        raise HTTPException(status_code=401, detail="Invalid secret.")

    token = create_access_token(
        subject="owner",
        extra_claims={"type": "owner"},
    )
    return OwnerTokenResponse(access_token=token)
@router.get("/firms", response_model=list[FirmSummary])
def list_firms(db: Session = Depends(get_db), _owner=Depends(get_current_owner)):
    repo = AuthRepository(db)
    return repo.list_all_firms()


@router.get("/firms/{firm_id}", response_model=FirmDetail)
def get_firm(firm_id: str, db: Session = Depends(get_db), _owner=Depends(get_current_owner)):
    auth_repo = AuthRepository(db)
    firm = auth_repo.get_firm_by_id(firm_id)
    if not firm:
        raise HTTPException(status_code=404, detail="Firm not found.")

    client_repo = ClientRepository(db)
    matter_repo = MatterRepository(db)

    return FirmDetail(
        id=firm.id,
        name=firm.name,
        email=firm.email,
        phone=firm.phone,
        website=firm.website,
        address=firm.address,
        is_active=firm.is_active,
        staff_count=auth_repo.count_users_for_firm(firm.id),
        client_count=client_repo.count_clients_for_firm(firm.id),
        matter_count=matter_repo.count_matters_for_firm(firm.id),
    )


@router.patch("/firms/{firm_id}/status", response_model=FirmSummary)
def update_firm_status(
    firm_id: str,
    request: UpdateFirmStatusRequest,
    db: Session = Depends(get_db),
    _owner=Depends(get_current_owner),
):
    auth_repo = AuthRepository(db)
    firm = auth_repo.get_firm_by_id(firm_id)
    if not firm:
        raise HTTPException(status_code=404, detail="Firm not found.")

    firm.is_active = request.is_active
    db.commit()
    return firm