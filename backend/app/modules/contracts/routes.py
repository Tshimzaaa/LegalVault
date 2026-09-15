from datetime import date, datetime, timedelta, UTC

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi import UploadFile, File, Form
from app.modules.contracts.schemas import ContractDocumentResponse, ContractDocumentDownloadResponse

from sqlalchemy.orm import Session
from app.database.session import get_db
from app.modules.contracts.schemas import (
    CreateContractRequest,
    ContractResponse,
    UpdateContractDetailsRequest,
    UpdateContractStageRequest,
    UpdateContractDeadlineRequest,
    AssignStaffRequest,
    ContractAssignmentResponse,
    CreateContractTaskRequest,
    UpdateContractTaskRequest,
    ContractTaskResponse,
    CalendarEvent,
    CreateContractMessageRequest,
    ContractMessageResponse,
    RequestContractApprovalRequest,
    DecideContractApprovalRequest,
    ContractApprovalResponse,
)
from app.modules.contracts.service import ContractService

from app.modules.auth.dependencies import get_current_user, require_role
from app.modules.auth.models import User
from app.modules.auth.models.role import UserRole

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# Core case work: create/update contracts, assign staff, manage documents.
_CASE_WORK = [UserRole.ADMIN, UserRole.LAWYER, UserRole.PARALEGAL]
# Coordination: tasks/messages secretaries routinely handle day to day.
_COORDINATION = [UserRole.ADMIN, UserRole.LAWYER, UserRole.PARALEGAL, UserRole.SECRETARY]


router = APIRouter(prefix="/contracts", tags=["contracts"])


@router.post("", response_model=ContractResponse, status_code=201)
def create_contract(
    request: CreateContractRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_CASE_WORK)),
):
    service = ContractService(db)
    return service.create_contract(current_user.org_id, current_user.id, request)


@router.get("", response_model=list[ContractResponse])
def list_contracts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ContractService(db)
    return service.list_contracts_for_org(current_user.org_id)


@router.get("/calendar", response_model=list[CalendarEvent])
def get_calendar(
    start: date | None = Query(default=None),
    end: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    range_start = start or datetime.now(UTC).date()
    range_end = end or (range_start + timedelta(days=30))
    service = ContractService(db)
    return service.get_calendar(current_user.org_id, range_start, range_end)


@router.get("/approvals/pending", response_model=list[ContractApprovalResponse])
def list_pending_approvals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ContractService(db)
    return service.list_pending_approvals(current_user.org_id)


@router.get("/{contract_id}", response_model=ContractResponse)
def get_contract(
    contract_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ContractService(db)
    return service.get_contract(contract_id, current_user.org_id)


@router.patch("/{contract_id}", response_model=ContractResponse)
def update_details(
    contract_id: str,
    request: UpdateContractDetailsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_CASE_WORK)),
):
    service = ContractService(db)
    return service.update_details(contract_id, current_user.org_id, current_user.id, request)


@router.patch("/{contract_id}/status", response_model=ContractResponse)
def update_status(
    contract_id: str,
    request: UpdateContractStageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_CASE_WORK)),
):
    service = ContractService(db)
    return service.update_status(contract_id, current_user.org_id, current_user.id, request)


@router.post("/{contract_id}/approvals", response_model=ContractApprovalResponse, status_code=201)
def request_status_approval(
    contract_id: str,
    request: RequestContractApprovalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_CASE_WORK)),
):
    service = ContractService(db)
    return service.request_status_approval(contract_id, current_user.org_id, current_user.id, request)


@router.get("/{contract_id}/approvals", response_model=list[ContractApprovalResponse])
def list_contract_approvals(
    contract_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ContractService(db)
    return service.list_approvals(contract_id, current_user.org_id)


@router.patch("/{contract_id}/approvals/{approval_id}", response_model=ContractApprovalResponse)
def decide_contract_approval(
    contract_id: str,
    approval_id: str,
    request: DecideContractApprovalRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_CASE_WORK)),
):
    service = ContractService(db)
    return service.decide_approval(
        contract_id, approval_id, current_user.org_id, current_user.id, current_user.role, request
    )


@router.patch("/{contract_id}/deadline", response_model=ContractResponse)
def update_deadline(
    contract_id: str,
    request: UpdateContractDeadlineRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_CASE_WORK)),
):
    service = ContractService(db)
    return service.update_deadline(contract_id, current_user.org_id, current_user.id, request)


@router.post("/{contract_id}/assignments", response_model=ContractAssignmentResponse, status_code=201)
def assign_staff(
    contract_id: str,
    request: AssignStaffRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_CASE_WORK)),
):
    service = ContractService(db)
    return service.assign_staff(contract_id, current_user.org_id, current_user.id, request)


@router.get("/{contract_id}/assignments", response_model=list[ContractAssignmentResponse])
def list_assignments(
    contract_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ContractService(db)
    return service.list_assignments(contract_id, current_user.org_id)


@router.post("/{contract_id}/documents", response_model=ContractDocumentResponse, status_code=201)
async def upload_contract_document(
    contract_id: str,
    title: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_CASE_WORK)),
):
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10MB.")

    service = ContractService(db)
    return service.upload_contract_document(
        contract_id=contract_id,
        org_id=current_user.org_id,
        uploaded_by=current_user.id,
        title=title,
        file_bytes=file_bytes,
        original_filename=file.filename,
        content_type=file.content_type,
    )


@router.get("/{contract_id}/documents", response_model=list[ContractDocumentResponse])
def list_contract_documents(
    contract_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ContractService(db)
    return service.list_contract_documents(contract_id, current_user.org_id)


@router.get("/{contract_id}/documents/{document_id}/download", response_model=ContractDocumentDownloadResponse)
def download_contract_document(
    contract_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ContractService(db)
    url = service.get_contract_document_download(contract_id, document_id, current_user.org_id)
    return ContractDocumentDownloadResponse(download_url=url, expires_in_seconds=3600)


@router.delete("/{contract_id}/documents/{document_id}", status_code=204)
def delete_contract_document(
    contract_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_CASE_WORK)),
):
    service = ContractService(db)
    service.delete_contract_document(contract_id, document_id, current_user.org_id, current_user.id)


@router.post("/{contract_id}/tasks", response_model=ContractTaskResponse, status_code=201)
def create_task(
    contract_id: str,
    request: CreateContractTaskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_COORDINATION)),
):
    service = ContractService(db)
    return service.create_task(contract_id, current_user.org_id, current_user.id, request)


@router.get("/{contract_id}/tasks", response_model=list[ContractTaskResponse])
def list_tasks(
    contract_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ContractService(db)
    return service.list_tasks(contract_id, current_user.org_id)


@router.patch("/{contract_id}/tasks/{task_id}", response_model=ContractTaskResponse)
def update_task(
    contract_id: str,
    task_id: str,
    request: UpdateContractTaskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_COORDINATION)),
):
    service = ContractService(db)
    return service.update_task(contract_id, task_id, current_user.org_id, current_user.id, request)


@router.delete("/{contract_id}/tasks/{task_id}", status_code=204)
def delete_task(
    contract_id: str,
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_CASE_WORK)),
):
    service = ContractService(db)
    service.delete_task(contract_id, task_id, current_user.org_id, current_user.id)


@router.post("/{contract_id}/messages", response_model=ContractMessageResponse, status_code=201)
def post_message(
    contract_id: str,
    request: CreateContractMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_COORDINATION)),
):
    service = ContractService(db)
    return service.post_message_as_staff(
        contract_id, current_user.org_id, current_user.id, f"{current_user.first_name} {current_user.last_name}", request
    )


@router.get("/{contract_id}/messages", response_model=list[ContractMessageResponse])
def list_messages(
    contract_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = ContractService(db)
    return service.list_messages(contract_id, current_user.org_id)


@router.delete("/{contract_id}/messages/{message_id}", status_code=204)
def delete_message(
    contract_id: str,
    message_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_COORDINATION)),
):
    service = ContractService(db)
    service.delete_message(contract_id, message_id, current_user.org_id, current_user.id, current_user.role == UserRole.ADMIN)
