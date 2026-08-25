from datetime import date, datetime, timedelta, UTC

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi import UploadFile, File, Form
from app.modules.matters.schemas import MatterDocumentResponse, MatterDocumentDownloadResponse

from sqlalchemy.orm import Session
from app.modules.clients.dependencies import get_current_contact
from app.modules.clients.models import ClientContact
from app.database.session import get_db
from app.modules.matters.schemas import (
    CreateMatterRequest,
    MatterResponse,
    UpdateMatterDetailsRequest,
    UpdateMatterStatusRequest,
    UpdateMatterVisibilityRequest,
    UpdateMatterDeadlineRequest,
    AssignStaffRequest,
    MatterAssignmentResponse,
    CreateMatterTaskRequest,
    UpdateMatterTaskRequest,
    MatterTaskResponse,
    CalendarEvent,
    CreateMatterMessageRequest,
    MatterMessageResponse,
    SetContactPermissionRequest,
    MatterContactPermissionResponse,
    RequestMatterApprovalRequest,
    DecideMatterApprovalRequest,
    MatterApprovalResponse,
    GenerateDocumentRequest,
)
from app.modules.matters.service import MatterService

from app.modules.auth.dependencies import get_current_user, require_role
from app.modules.auth.models import User
from app.modules.auth.models.role import UserRole

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# Core case work: create/update matters, assign staff, manage documents.
_CASE_WORK = [UserRole.ADMIN, UserRole.LAWYER, UserRole.PARALEGAL]
# Coordination: tasks/messages secretaries routinely handle day to day.
_COORDINATION = [UserRole.ADMIN, UserRole.LAWYER, UserRole.PARALEGAL, UserRole.SECRETARY]


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
    current_user: User = Depends(require_role(_CASE_WORK)),
):
    service = MatterService(db)
    return service.create_matter(current_user.firm_id, current_user.id, request)


@router.get("", response_model=list[MatterResponse])
def list_matters(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = MatterService(db)
    return service.list_matters_for_firm(current_user.firm_id)


@router.get("/calendar", response_model=list[CalendarEvent])
def get_calendar(
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    range_start = start or datetime.now(UTC).date()
    range_end = end or (range_start + timedelta(days=30))
    service = MatterService(db)
    return service.get_calendar(current_user.firm_id, range_start, range_end)


@client_matters_router.get("/calendar", response_model=list[CalendarEvent])
def get_client_calendar(
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_contact: ClientContact = Depends(get_current_contact),
):
    range_start = start or datetime.now(UTC).date()
    range_end = end or (range_start + timedelta(days=30))
    service = MatterService(db)
    return service.get_client_calendar(current_contact.client_id, range_start, range_end)


@router.get("/approvals/pending", response_model=list[MatterApprovalResponse])
def list_pending_approvals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = MatterService(db)
    return service.list_pending_approvals(current_user.firm_id)


@router.get("/{matter_id}", response_model=MatterResponse)
def get_matter(
    matter_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = MatterService(db)
    return service.get_matter(matter_id, current_user.firm_id)


@router.patch("/{matter_id}", response_model=MatterResponse)
def update_details(
    matter_id: str,
    request: UpdateMatterDetailsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_CASE_WORK)),
):
    service = MatterService(db)
    return service.update_details(matter_id, current_user.firm_id, current_user.id, request)


@router.patch("/{matter_id}/status", response_model=MatterResponse)
def update_status(
    matter_id: str,
    request: UpdateMatterStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_CASE_WORK)),
):
    service = MatterService(db)
    return service.update_status(matter_id, current_user.firm_id, current_user.id, request)


@router.post("/{matter_id}/approvals", response_model=MatterApprovalResponse, status_code=201)
def request_status_approval(
    matter_id: str,
    request: RequestMatterApprovalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_CASE_WORK)),
):
    service = MatterService(db)
    return service.request_status_approval(matter_id, current_user.firm_id, current_user.id, request)


@router.get("/{matter_id}/approvals", response_model=list[MatterApprovalResponse])
def list_matter_approvals(
    matter_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = MatterService(db)
    return service.list_approvals(matter_id, current_user.firm_id)


@router.patch("/{matter_id}/approvals/{approval_id}", response_model=MatterApprovalResponse)
def decide_matter_approval(
    matter_id: str,
    approval_id: str,
    request: DecideMatterApprovalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_CASE_WORK)),
):
    service = MatterService(db)
    return service.decide_approval(
        matter_id, approval_id, current_user.firm_id, current_user.id, current_user.role, request
    )


@router.patch("/{matter_id}/visibility", response_model=MatterResponse)
def update_visibility(
    matter_id: str,
    request: UpdateMatterVisibilityRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_CASE_WORK)),
):
    service = MatterService(db)
    return service.update_visibility(matter_id, current_user.firm_id, current_user.id, request)


@router.patch("/{matter_id}/deadline", response_model=MatterResponse)
def update_deadline(
    matter_id: str,
    request: UpdateMatterDeadlineRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_CASE_WORK)),
):
    service = MatterService(db)
    return service.update_deadline(matter_id, current_user.firm_id, current_user.id, request)


@router.post("/{matter_id}/assignments", response_model=MatterAssignmentResponse, status_code=201)
def assign_staff(
    matter_id: str,
    request: AssignStaffRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_CASE_WORK)),
):
    service = MatterService(db)
    return service.assign_staff(matter_id, current_user.firm_id, current_user.id, request)


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
    current_user: User = Depends(require_role(_CASE_WORK)),
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


@router.post("/{matter_id}/documents/generate", response_model=MatterDocumentResponse, status_code=201)
def generate_matter_document(
    matter_id: str,
    request: GenerateDocumentRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_CASE_WORK)),
):
    service = MatterService(db)
    return service.generate_document_from_template(matter_id, current_user.firm_id, current_user.id, request)


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


@router.delete("/{matter_id}/documents/{document_id}", status_code=204)
def delete_matter_document(
    matter_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_CASE_WORK)),
):
    service = MatterService(db)
    service.delete_matter_document(matter_id, document_id, current_user.firm_id, current_user.id)


@router.post("/{matter_id}/tasks", response_model=MatterTaskResponse, status_code=201)
def create_task(
    matter_id: str,
    request: CreateMatterTaskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_COORDINATION)),
):
    service = MatterService(db)
    return service.create_task(matter_id, current_user.firm_id, current_user.id, request)


@router.get("/{matter_id}/tasks", response_model=list[MatterTaskResponse])
def list_tasks(
    matter_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = MatterService(db)
    return service.list_tasks(matter_id, current_user.firm_id)


@router.patch("/{matter_id}/tasks/{task_id}", response_model=MatterTaskResponse)
def update_task(
    matter_id: str,
    task_id: str,
    request: UpdateMatterTaskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_COORDINATION)),
):
    service = MatterService(db)
    return service.update_task(matter_id, task_id, current_user.firm_id, current_user.id, request)


@router.delete("/{matter_id}/tasks/{task_id}", status_code=204)
def delete_task(
    matter_id: str,
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_CASE_WORK)),
):
    service = MatterService(db)
    service.delete_task(matter_id, task_id, current_user.firm_id, current_user.id)


@router.post("/{matter_id}/messages", response_model=MatterMessageResponse, status_code=201)
def post_message(
    matter_id: str,
    request: CreateMatterMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_COORDINATION)),
):
    service = MatterService(db)
    return service.post_message_as_staff(
        matter_id, current_user.firm_id, current_user.id, f"{current_user.first_name} {current_user.last_name}", request
    )


@router.get("/{matter_id}/messages", response_model=list[MatterMessageResponse])
def list_messages(
    matter_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = MatterService(db)
    return service.list_messages(matter_id, current_user.firm_id)


@router.delete("/{matter_id}/messages/{message_id}", status_code=204)
def delete_message(
    matter_id: str,
    message_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_COORDINATION)),
):
    service = MatterService(db)
    service.delete_message(matter_id, message_id, current_user.firm_id, current_user.id, current_user.role == UserRole.ADMIN)


@client_matters_router.get("/{matter_id}/documents", response_model=list[MatterDocumentResponse])
def list_my_matter_documents(
    matter_id: str,
    db: Session = Depends(get_db),
    current_contact: ClientContact = Depends(get_current_contact),
):
    service = MatterService(db)
    return service.list_client_matter_documents(matter_id, current_contact.client_id)


@client_matters_router.get("/{matter_id}/documents/{document_id}/download", response_model=MatterDocumentDownloadResponse)
def download_my_matter_document(
    matter_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    current_contact: ClientContact = Depends(get_current_contact),
):
    service = MatterService(db)
    url = service.get_client_matter_document_download(matter_id, document_id, current_contact.client_id)
    return MatterDocumentDownloadResponse(download_url=url, expires_in_seconds=3600)

@client_matters_router.post("/{matter_id}/documents", response_model=MatterDocumentResponse, status_code=201)
async def upload_my_matter_document(
    matter_id: str,
    title: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_contact: ClientContact = Depends(get_current_contact),
):
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10MB.")

    service = MatterService(db)
    return service.upload_matter_document(
        matter_id=matter_id,
        title=title,
        file_bytes=file_bytes,
        original_filename=file.filename,
        content_type=file.content_type,
        client_id=current_contact.client_id,
        uploaded_by_contact_id=current_contact.id,
    )


@client_matters_router.post("/{matter_id}/messages", response_model=MatterMessageResponse, status_code=201)
def post_client_message(
    matter_id: str,
    request: CreateMatterMessageRequest,
    db: Session = Depends(get_db),
    current_contact: ClientContact = Depends(get_current_contact),
):
    service = MatterService(db)
    return service.post_message_as_client(
        matter_id, current_contact.client_id, current_contact.id, f"{current_contact.first_name} {current_contact.last_name}", request
    )


@client_matters_router.get("/{matter_id}/messages", response_model=list[MatterMessageResponse])
def list_client_messages(
    matter_id: str,
    db: Session = Depends(get_db),
    current_contact: ClientContact = Depends(get_current_contact),
):
    service = MatterService(db)
    return service.list_client_messages(matter_id, current_contact.client_id)


@client_matters_router.delete("/{matter_id}/messages/{message_id}", status_code=204)
def delete_client_message(
    matter_id: str,
    message_id: str,
    db: Session = Depends(get_db),
    current_contact: ClientContact = Depends(get_current_contact),
):
    service = MatterService(db)
    service.delete_client_message(matter_id, message_id, current_contact.client_id, current_contact.id)


@router.post("/{matter_id}/contact-permissions", response_model=MatterContactPermissionResponse, status_code=201)
def set_contact_permission(
    matter_id: str,
    request: SetContactPermissionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_CASE_WORK)),
):
    service = MatterService(db)
    return service.set_contact_permission(matter_id, current_user.firm_id, current_user.id, request)


@router.get("/{matter_id}/contact-permissions", response_model=list[MatterContactPermissionResponse])
def list_contact_permissions(
    matter_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = MatterService(db)
    return service.list_contact_permissions(matter_id, current_user.firm_id)


@router.delete("/{matter_id}/contact-permissions/{client_contact_id}", status_code=204)
def remove_contact_permission(
    matter_id: str,
    client_contact_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_CASE_WORK)),
):
    service = MatterService(db)
    service.remove_contact_permission(matter_id, current_user.firm_id, current_user.id, client_contact_id)


@client_matters_router.get("/contact-permissions", response_model=list[MatterContactPermissionResponse])
def list_my_contact_permissions(
    db: Session = Depends(get_db),
    current_contact: ClientContact = Depends(get_current_contact),
):
    service = MatterService(db)
    return service.list_my_contact_permissions(current_contact.client_id)