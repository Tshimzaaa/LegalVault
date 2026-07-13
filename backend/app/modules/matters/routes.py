from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.modules.matters.schemas import (
    CreateMatterRequest,
    MatterResponse,
    UpdateMatterStatusRequest,
    UpdateMatterVisibilityRequest,
    AssignStaffRequest,
    MatterAssignmentResponse,
)
from app.modules.matters.service import MatterService

from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User

router = APIRouter(prefix="/matters", tags=["matters"])


@router.post("", response_model=MatterResponse, status_code=201)
def create_matter(
    request: CreateMatterRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = MatterService(db)
    return service.create_matter(current_user.firm_id, request)


@router.get("", response_model=list[MatterResponse])
def list_matters(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = MatterService(db)
    return service.list_matters_for_firm(current_user.firm_id)


@router.get("/{matter_id}", response_model=MatterResponse)
def get_matter(
    matter_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = MatterService(db)
    return service.get_matter(matter_id, current_user.firm_id)


@router.patch("/{matter_id}/status", response_model=MatterResponse)
def update_status(
    matter_id: str,
    request: UpdateMatterStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = MatterService(db)
    return service.update_status(matter_id, current_user.firm_id, request)


@router.patch("/{matter_id}/visibility", response_model=MatterResponse)
def update_visibility(
    matter_id: str,
    request: UpdateMatterVisibilityRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = MatterService(db)
    return service.update_visibility(matter_id, current_user.firm_id, request)


@router.post("/{matter_id}/assignments", response_model=MatterAssignmentResponse, status_code=201)
def assign_staff(
    matter_id: str,
    request: AssignStaffRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = MatterService(db)
    return service.assign_staff(matter_id, current_user.firm_id, request)
@router.get("/{matter_id}/assignments", response_model=list[MatterAssignmentResponse])
def list_assignments(
    matter_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = MatterService(db)
    return service.list_assignments(matter_id, current_user.firm_id)