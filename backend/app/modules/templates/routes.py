from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.modules.templates.schemas import TemplateResponse, TemplateDownloadResponse, UpdateTemplateRequest
from app.modules.templates.service import TemplateService

from app.modules.auth.dependencies import get_current_user, require_role
from app.modules.auth.models import User
from app.modules.auth.models.role import UserRole

router = APIRouter(prefix="/templates", tags=["templates"])
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("", response_model=TemplateResponse, status_code=201)
async def upload_template(
    title: str = Form(...),
    description: str | None = Form(None),
    category: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.LAWYER])),
):
    file_bytes = await file.read()

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10MB.")

    service = TemplateService(db)
    return service.upload_template(
        org_id=current_user.org_id,
        actor_id=current_user.id,
        title=title,
        description=description,
        category=category,
        file_bytes=file_bytes,
        original_filename=file.filename,
        content_type=file.content_type,
    )


@router.get("", response_model=list[TemplateResponse])
def list_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = TemplateService(db)
    return service.list_templates(current_user.org_id)


@router.patch("/{template_id}", response_model=TemplateResponse)
def update_template(
    template_id: str,
    request: UpdateTemplateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.LAWYER])),
):
    service = TemplateService(db)
    return service.update_template(template_id, current_user.org_id, current_user.id, request)


@router.delete("/{template_id}", status_code=204)
def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN])),
):
    service = TemplateService(db)
    service.delete_template(template_id, current_user.org_id, current_user.id)


@router.get("/{template_id}/download", response_model=TemplateDownloadResponse)
def download_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = TemplateService(db)
    url = service.get_download_link(template_id, current_user.org_id)
    return TemplateDownloadResponse(download_url=url, expires_in_seconds=3600)