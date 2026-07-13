from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.modules.templates.schemas import TemplateResponse, TemplateDownloadResponse
from app.modules.templates.service import TemplateService

from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.clients.dependencies import get_current_contact
from app.modules.clients.models import ClientContact
from app.modules.clients.repository import ClientRepository
from app.exceptions.clients import ClientNotFound

router = APIRouter(prefix="/templates", tags=["templates"])
client_templates_router = APIRouter(prefix="/client-templates", tags=["client-templates"])
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

@router.post("", response_model=TemplateResponse, status_code=201)
async def upload_template(
    title: str = Form(...),
    description: str | None = Form(None),
    category: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    file_bytes = await file.read()
    service = TemplateService(db)
    return service.upload_template(
        firm_id=current_user.firm_id,
        title=title,
        description=description,
        category=category,
        file_bytes=file_bytes,
        original_filename=file.filename,
        content_type=file.content_type,
    )
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10MB.")


@router.get("", response_model=list[TemplateResponse])
def list_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = TemplateService(db)
    return service.list_templates(current_user.firm_id)


@router.get("/{template_id}/download", response_model=TemplateDownloadResponse)
def download_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = TemplateService(db)
    url = service.get_download_link(template_id, current_user.firm_id)
    return TemplateDownloadResponse(download_url=url, expires_in_seconds=3600)

def _get_firm_id_for_contact(contact: ClientContact, db: Session) -> str:
    client_repo = ClientRepository(db)
    client = client_repo.get_client_by_id(contact.client_id)
    if not client:
        raise ClientNotFound()
    return client.firm_id


@client_templates_router.get("", response_model=list[TemplateResponse])
def list_client_templates(
    db: Session = Depends(get_db),
    current_contact: ClientContact = Depends(get_current_contact),
):
    firm_id = _get_firm_id_for_contact(current_contact, db)
    service = TemplateService(db)
    return service.list_templates(firm_id)


@client_templates_router.get("/{template_id}/download", response_model=TemplateDownloadResponse)
def download_client_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_contact: ClientContact = Depends(get_current_contact),
):
    firm_id = _get_firm_id_for_contact(current_contact, db)
    service = TemplateService(db)
    url = service.get_download_link(template_id, firm_id)
    return TemplateDownloadResponse(download_url=url, expires_in_seconds=3600)
