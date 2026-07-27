from fastapi import APIRouter, Depends, HTTPException
from fastapi import UploadFile, File, Form
from app.modules.matters.schemas import MatterDocumentResponse, MatterDocumentDownloadResponse

from sqlalchemy.orm import Session
from app.modules.clients.dependencies import get_current_contact
from app.modules.clients.models import ClientContact
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

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


router = APIRouter(prefix="/matters", tags=["matters"])
client_matters_router = APIRouter(prefix="/client-matters", tags=["client-matters"])


@client_matters_router.get("", response_model=list[MatterResponse])
def list_my_matters(
    db: Session = Depends(get_db),
    current_contact: ClientContact = Depends(get_current_contact),
):
    service = MatterService(db)
    return service.list_visible_matters_for_client(current_contact.client_id)


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


@router.post("/{matter_id}/documents", response_model=MatterDocumentResponse, status_code=201)
async def upload_matter_document(
    matter_id: str,
    title: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10MB.")

    service = MatterService(db)
    return service.upload_matter_document(
        matter_id=matter_id,
        firm_id=current_user.firm_id,
        uploaded_by=current_user.id,
        title=title,
        file_bytes=file_bytes,
        original_filename=file.filename,
        content_type=file.content_type,
    )


@router.get("/{matter_id}/documents", response_model=list[MatterDocumentResponse])
def list_matter_documents(
    matter_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = MatterService(db)
    return service.list_matter_documents(matter_id, current_user.firm_id)


@router.get("/{matter_id}/documents/{document_id}/download", response_model=MatterDocumentDownloadResponse)
def download_matter_document(
    matter_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = MatterService(db)
    url = service.get_matter_document_download(matter_id, document_id, current_user.firm_id)
    return MatterDocumentDownloadResponse(download_url=url, expires_in_seconds=3600)