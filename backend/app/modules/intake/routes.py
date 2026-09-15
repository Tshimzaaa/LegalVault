import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.modules.auth.dependencies import get_current_user, require_role
from app.modules.auth.models import User
from app.modules.auth.models.role import UserRole
from app.modules.intake.schemas import (
    IntakeFormResponse,
    IntakeFormFieldResponse,
    IntakeSubmissionResponse,
    UpdateIntakeSubmissionStatusRequest,
    ConvertIntakeSubmissionRequest,
    IntakeAnswerDownloadResponse,
    IntakeFormCreateRequest,
    IntakeFormUpdateRequest,
    IntakeFormFieldCreateRequest,
    IntakeFormFieldUpdateRequest,
    ReorderFieldsRequest,
)
from app.modules.intake.service import IntakeService, MAX_ANSWER_FILE_SIZE

router = APIRouter(prefix="/intake-forms", tags=["intake-forms"])
submissions_router = APIRouter(prefix="/intake-submissions", tags=["intake-submissions"])

_BUILDER_ROLES = [UserRole.ADMIN, UserRole.LAWYER]


# ---- Intake form builder. Every org also has one system-seeded "Contract Request"
# form (see system_forms.py) — protected from edit/delete/publish-state changes by
# IntakeService (raises SystemFormNotEditable). ----

@router.get("", response_model=list[IntakeFormResponse])
def list_intake_forms(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = IntakeService(db)
    return service.list_forms(current_user.org_id)


@router.get("/{form_id}", response_model=IntakeFormResponse)
def get_intake_form(
    form_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = IntakeService(db)
    return service.get_form(form_id, current_user.org_id)


@router.post("", response_model=IntakeFormResponse, status_code=201)
def create_intake_form(
    request: IntakeFormCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_BUILDER_ROLES)),
):
    service = IntakeService(db)
    return service.create_form(current_user.org_id, current_user.id, request)


@router.patch("/{form_id}", response_model=IntakeFormResponse)
def update_intake_form(
    form_id: str,
    request: IntakeFormUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_BUILDER_ROLES)),
):
    service = IntakeService(db)
    return service.update_form(form_id, current_user.org_id, current_user.id, request)


@router.delete("/{form_id}", status_code=204)
def delete_intake_form(
    form_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_BUILDER_ROLES)),
):
    service = IntakeService(db)
    service.delete_form(form_id, current_user.org_id, current_user.id)


@router.post("/{form_id}/publish", response_model=IntakeFormResponse)
def publish_intake_form(
    form_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_BUILDER_ROLES)),
):
    service = IntakeService(db)
    return service.set_published(form_id, current_user.org_id, current_user.id, True)


@router.post("/{form_id}/unpublish", response_model=IntakeFormResponse)
def unpublish_intake_form(
    form_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_BUILDER_ROLES)),
):
    service = IntakeService(db)
    return service.set_published(form_id, current_user.org_id, current_user.id, False)


@router.patch("/{form_id}/fields/reorder", response_model=IntakeFormResponse)
def reorder_intake_form_fields(
    form_id: str,
    request: ReorderFieldsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_BUILDER_ROLES)),
):
    # Must be registered before /{form_id}/fields/{field_id} below — FastAPI matches
    # routes in registration order, and "reorder" would otherwise be captured as field_id.
    service = IntakeService(db)
    return service.reorder_fields(form_id, current_user.org_id, current_user.id, request)


@router.post("/{form_id}/fields", response_model=IntakeFormFieldResponse, status_code=201)
def add_intake_form_field(
    form_id: str,
    request: IntakeFormFieldCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_BUILDER_ROLES)),
):
    service = IntakeService(db)
    return service.add_field(form_id, current_user.org_id, current_user.id, request)


@router.patch("/{form_id}/fields/{field_id}", response_model=IntakeFormFieldResponse)
def update_intake_form_field(
    form_id: str,
    field_id: str,
    request: IntakeFormFieldUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_BUILDER_ROLES)),
):
    service = IntakeService(db)
    return service.update_field(form_id, current_user.org_id, current_user.id, field_id, request)


@router.delete("/{form_id}/fields/{field_id}", status_code=204)
def delete_intake_form_field(
    form_id: str,
    field_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_BUILDER_ROLES)),
):
    service = IntakeService(db)
    service.delete_field(form_id, current_user.org_id, current_user.id, field_id)


# ---- Submissions: any staff member can submit (e.g. procurement requesting a
# contract); triage/convert is restricted to the builder roles. ----

@router.post("/{form_id}/submit", response_model=IntakeSubmissionResponse, status_code=201)
async def submit_intake_form(
    form_id: str,
    answers_json: str = Form("{}"),
    file_field_ids: list[str] = Form(default=[]),
    files: list[UploadFile] = File(default=[]),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        answers = json.loads(answers_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="answers_json must be valid JSON.")
    if not isinstance(answers, dict):
        raise HTTPException(status_code=400, detail="answers_json must be a JSON object of field_id -> value.")
    if len(file_field_ids) != len(files):
        raise HTTPException(status_code=400, detail="file_field_ids and files must be the same length.")

    file_map: dict[str, tuple[bytes, str, str]] = {}
    for field_id, upload in zip(file_field_ids, files):
        file_bytes = await upload.read()
        if len(file_bytes) > MAX_ANSWER_FILE_SIZE:
            raise HTTPException(status_code=413, detail="File too large. Maximum size is 10MB.")
        file_map[field_id] = (file_bytes, upload.filename, upload.content_type)

    service = IntakeService(db)
    return service.submit(
        org_id=current_user.org_id,
        submitted_by=current_user.id,
        form_id=form_id,
        answers=answers,
        files=file_map,
    )


@submissions_router.get("", response_model=list[IntakeSubmissionResponse])
def list_intake_submissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = IntakeService(db)
    return service.list_submissions(current_user.org_id)


@submissions_router.get("/mine", response_model=list[IntakeSubmissionResponse])
def list_my_intake_submissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = IntakeService(db)
    return service.list_my_submissions(current_user.id)


@submissions_router.get("/{submission_id}", response_model=IntakeSubmissionResponse)
def get_intake_submission(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = IntakeService(db)
    return service.get_submission(submission_id, current_user.org_id)


@submissions_router.patch("/{submission_id}/status", response_model=IntakeSubmissionResponse)
def update_intake_submission_status(
    submission_id: str,
    request: UpdateIntakeSubmissionStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_BUILDER_ROLES)),
):
    service = IntakeService(db)
    return service.update_submission_status(submission_id, current_user.org_id, current_user.id, request)


@submissions_router.post("/{submission_id}/convert", response_model=IntakeSubmissionResponse)
def convert_intake_submission(
    submission_id: str,
    request: ConvertIntakeSubmissionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_BUILDER_ROLES)),
):
    service = IntakeService(db)
    return service.convert_to_contract(submission_id, current_user.org_id, current_user.id, request)


@submissions_router.get("/{submission_id}/answers/{answer_id}/download", response_model=IntakeAnswerDownloadResponse)
def download_intake_answer_file(
    submission_id: str,
    answer_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = IntakeService(db)
    url = service.get_answer_download_link(submission_id, current_user.org_id, answer_id)
    return IntakeAnswerDownloadResponse(download_url=url, expires_in_seconds=3600)
