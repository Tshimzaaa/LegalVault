from datetime import date

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.modules.signed_contracts.schemas import (
    SignedContractResponse,
    SignedContractDownloadResponse,
    SignedContractsSummaryResponse,
    UpdateSignedContractStatusRequest,
)
from app.modules.signed_contracts.models import ContractType
from app.modules.signed_contracts.service import SignedContractService

from app.modules.auth.dependencies import get_current_user, require_role
from app.modules.auth.models import User
from app.modules.auth.models.role import UserRole
from app.modules.clients.dependencies import get_current_contact
from app.modules.clients.models import ClientContact

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

router = APIRouter(prefix="/signed-contracts", tags=["signed-contracts"])
client_signed_contracts_router = APIRouter(prefix="/client-signed-contracts", tags=["client-signed-contracts"])


@router.post("", response_model=SignedContractResponse, status_code=201)
async def upload_signed_contract(
    client_id: str = Form(...),
    title: str = Form(..., min_length=2, max_length=200),
    agreement_type: ContractType = Form(...),
    signed_date: date = Form(...),
    description: str | None = Form(None, max_length=1000),
    expiry_date: date | None = Form(None),
    integration_source: str = Form("manual", max_length=50),
    matter_id: str | None = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.LAWYER, UserRole.PARALEGAL])),
):
    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10MB.")

    service = SignedContractService(db)
    return service.upload_contract(
        org_id=current_user.org_id,
        actor_id=current_user.id,
        client_id=client_id,
        title=title,
        agreement_type=agreement_type,
        signed_date=signed_date,
        file_bytes=file_bytes,
        original_filename=file.filename,
        content_type=file.content_type,
        description=description,
        expiry_date=expiry_date,
        integration_source=integration_source,
        matter_id=matter_id or None,
    )


@router.get("", response_model=list[SignedContractResponse])
def list_signed_contracts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = SignedContractService(db)
    return service.list_for_org(current_user.org_id)


@router.get("/summary", response_model=SignedContractsSummaryResponse)
def get_signed_contracts_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = SignedContractService(db)
    return service.get_summary_for_org(current_user.org_id)


@router.get("/{contract_id}/download", response_model=SignedContractDownloadResponse)
def download_signed_contract(
    contract_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = SignedContractService(db)
    url = service.get_download_link(contract_id, current_user.org_id)
    return SignedContractDownloadResponse(download_url=url, expires_in_seconds=3600)


@router.patch("/{contract_id}/status", response_model=SignedContractResponse)
def update_signed_contract_status(
    contract_id: str,
    request: UpdateSignedContractStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role([UserRole.ADMIN, UserRole.LAWYER, UserRole.PARALEGAL, UserRole.SECRETARY])
    ),
):
    service = SignedContractService(db)
    return service.update_status(contract_id, current_user.org_id, current_user.id, request.status)


@client_signed_contracts_router.get("", response_model=list[SignedContractResponse])
def list_client_signed_contracts(
    db: Session = Depends(get_db),
    current_contact: ClientContact = Depends(get_current_contact),
):
    service = SignedContractService(db)
    return service.list_for_client(current_contact.client_id)


@client_signed_contracts_router.get("/summary", response_model=SignedContractsSummaryResponse)
def get_client_signed_contracts_summary(
    db: Session = Depends(get_db),
    current_contact: ClientContact = Depends(get_current_contact),
):
    service = SignedContractService(db)
    return service.get_summary_for_client(current_contact.client_id)


@client_signed_contracts_router.get("/{contract_id}/download", response_model=SignedContractDownloadResponse)
def download_client_signed_contract(
    contract_id: str,
    db: Session = Depends(get_db),
    current_contact: ClientContact = Depends(get_current_contact),
):
    service = SignedContractService(db)
    url = service.get_client_download_link(contract_id, current_contact.client_id)
    return SignedContractDownloadResponse(download_url=url, expires_in_seconds=3600)
