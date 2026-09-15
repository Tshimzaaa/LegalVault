import uuid
from sqlalchemy.orm import Session

from app.modules.intake.repository import IntakeRepository
from app.modules.intake.models import (
    IntakeForm,
    IntakeFormField,
    IntakeFieldType,
    IntakeSubmission,
    IntakeSubmissionAnswer,
    IntakeSubmissionStatus,
)
from app.modules.intake.schemas import (
    UpdateIntakeSubmissionStatusRequest,
    ConvertIntakeSubmissionRequest,
    IntakeFormCreateRequest,
    IntakeFormUpdateRequest,
    IntakeFormFieldCreateRequest,
    IntakeFormFieldUpdateRequest,
    ReorderFieldsRequest,
)
from app.exceptions.intake import (
    IntakeFormNotFound,
    IntakeSubmissionNotFound,
    IntakeAnswerNotFound,
    IntakeFormNotPublished,
    MissingRequiredIntakeAnswer,
    UnsupportedIntakeFileType,
    SystemFormNotEditable,
    IntakeFormFieldNotFound,
)
from app.core.storage import upload_file, get_download_url
from app.core.malware_scan import scan_file
from app.modules.audit.service import AuditService
from app.modules.audit.models import ActorType
from app.modules.audit import actions as audit_actions
from app.modules.notifications.service import NotificationService
from app.modules.notifications.models import RecipientType
from app.modules.auth.repository import AuthRepository
from app.modules.contracts.service import ContractService
from app.modules.contracts.schemas import CreateContractRequest

ALLOWED_ANSWER_FILE_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # .docx
    "application/msword",  # .doc
    "text/plain",  # .txt
    "image/jpeg",
    "image/png",
}

MAX_ANSWER_FILE_SIZE = 10 * 1024 * 1024  # 10MB


class IntakeService:

    def __init__(self, db: Session):
        self.db = db
        self.repository = IntakeRepository(db)
        self.auth_repository = AuthRepository(db)
        self.audit = AuditService(db)
        self.notifications = NotificationService(db)

    # ---- Forms (builder) ----

    def get_form(self, form_id, org_id) -> IntakeForm:
        form = self.repository.get_form_by_id(form_id)
        if not form or str(form.org_id) != str(org_id):
            raise IntakeFormNotFound()
        return form

    def list_forms(self, org_id) -> list[IntakeForm]:
        return self.repository.list_forms_by_org(org_id)

    def create_form(self, org_id, actor_id, request: IntakeFormCreateRequest) -> IntakeForm:
        form = IntakeForm(org_id=org_id, title=request.title, description=request.description, created_by=actor_id)
        self.repository.create_form(form)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.INTAKE_FORM_CREATED,
            target_type="intake_form",
            target_id=form.id,
            details={"title": form.title},
        )
        self.db.commit()
        return form

    def update_form(self, form_id, org_id, actor_id, request: IntakeFormUpdateRequest) -> IntakeForm:
        form = self.get_form(form_id, org_id)
        if form.is_system:
            raise SystemFormNotEditable()

        updates = request.model_dump(exclude_unset=True)
        for field, value in updates.items():
            setattr(form, field, value)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.INTAKE_FORM_UPDATED,
            target_type="intake_form",
            target_id=form.id,
            details=updates,
        )
        self.db.commit()
        return form

    def delete_form(self, form_id, org_id, actor_id) -> None:
        form = self.get_form(form_id, org_id)
        if form.is_system:
            raise SystemFormNotEditable()

        self.repository.delete_form(form)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.INTAKE_FORM_DELETED,
            target_type="intake_form",
            target_id=form.id,
            details={"title": form.title},
        )
        self.db.commit()

    def set_published(self, form_id, org_id, actor_id, published: bool) -> IntakeForm:
        form = self.get_form(form_id, org_id)
        if form.is_system:
            raise SystemFormNotEditable()

        form.is_published = published
        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.INTAKE_FORM_PUBLISHED if published else audit_actions.INTAKE_FORM_UNPUBLISHED,
            target_type="intake_form",
            target_id=form.id,
            details={},
        )
        self.db.commit()
        return form

    # ---- Form fields (builder) ----

    def add_field(self, form_id, org_id, actor_id, request: IntakeFormFieldCreateRequest) -> IntakeFormField:
        form = self.get_form(form_id, org_id)
        if form.is_system:
            raise SystemFormNotEditable()

        next_order = max((f.display_order for f in form.fields), default=-1) + 1
        field = IntakeFormField(
            form_id=form.id,
            label=request.label,
            field_type=request.field_type,
            is_required=request.is_required,
            help_text=request.help_text,
            options=request.options,
            display_order=next_order,
        )
        self.repository.create_field(field)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.INTAKE_FORM_FIELD_ADDED,
            target_type="intake_form_field",
            target_id=field.id,
            details={"form_id": str(form.id), "label": field.label},
        )
        self.db.commit()
        return field

    def _get_owned_field(self, form_id, org_id, field_id) -> IntakeFormField:
        form = self.get_form(form_id, org_id)
        if form.is_system:
            raise SystemFormNotEditable()

        field = self.repository.get_field_by_id(field_id)
        if not field or str(field.form_id) != str(form.id):
            raise IntakeFormFieldNotFound()
        return field

    def update_field(
        self, form_id, org_id, actor_id, field_id, request: IntakeFormFieldUpdateRequest
    ) -> IntakeFormField:
        field = self._get_owned_field(form_id, org_id, field_id)

        updates = request.model_dump(exclude_unset=True)
        for attr, value in updates.items():
            setattr(field, attr, value)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.INTAKE_FORM_FIELD_UPDATED,
            target_type="intake_form_field",
            target_id=field.id,
            details=updates,
        )
        self.db.commit()
        return field

    def delete_field(self, form_id, org_id, actor_id, field_id) -> None:
        field = self._get_owned_field(form_id, org_id, field_id)
        self.repository.delete_field(field)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.INTAKE_FORM_FIELD_DELETED,
            target_type="intake_form_field",
            target_id=field.id,
            details={"form_id": str(form_id)},
        )
        self.db.commit()

    def reorder_fields(self, form_id, org_id, actor_id, request: ReorderFieldsRequest) -> IntakeForm:
        form = self.get_form(form_id, org_id)
        if form.is_system:
            raise SystemFormNotEditable()

        fields_by_id = {field.id: field for field in form.fields}
        if set(str(fid) for fid in request.field_ids) != set(str(fid) for fid in fields_by_id):
            raise IntakeFormFieldNotFound()

        for order, field_id in enumerate(request.field_ids):
            fields_by_id[field_id].display_order = order

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.INTAKE_FORM_FIELDS_REORDERED,
            target_type="intake_form",
            target_id=form.id,
            details={},
        )
        self.db.commit()
        return self.get_form(form_id, org_id)

    # ---- Submissions ----

    def get_submission(self, submission_id, org_id) -> IntakeSubmission:
        submission = self.repository.get_submission_by_id(submission_id)
        if not submission or str(submission.org_id) != str(org_id):
            raise IntakeSubmissionNotFound()
        return submission

    def list_submissions(self, org_id) -> list[IntakeSubmission]:
        return self.repository.list_submissions_by_org(org_id)

    def list_my_submissions(self, user_id) -> list[IntakeSubmission]:
        return self.repository.list_submissions_by_user(user_id)

    def update_submission_status(
        self, submission_id, org_id, actor_id, request: UpdateIntakeSubmissionStatusRequest
    ) -> IntakeSubmission:
        submission = self.get_submission(submission_id, org_id)
        submission.status = request.status
        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.INTAKE_SUBMISSION_STATUS_UPDATED,
            target_type="intake_submission",
            target_id=submission.id,
            details={"status": request.status.value},
        )
        self.db.commit()
        return submission

    def convert_to_contract(
        self, submission_id, org_id, actor_id, request: ConvertIntakeSubmissionRequest
    ) -> IntakeSubmission:
        submission = self.get_submission(submission_id, org_id)
        form = self.get_form(submission.form_id, org_id)

        title = request.contract_title or form.title

        contract_service = ContractService(self.db)
        contract = contract_service.create_contract(
            org_id, actor_id, CreateContractRequest(title=title, description=None, due_date=None)
        )

        submission.converted_contract_id = contract.id
        submission.status = IntakeSubmissionStatus.CONVERTED
        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.INTAKE_SUBMISSION_CONVERTED,
            target_type="intake_submission",
            target_id=submission.id,
            details={"contract_id": str(contract.id)},
        )
        self.db.commit()
        return submission

    def get_answer_download_link(self, submission_id, org_id, answer_id) -> str:
        submission = self.get_submission(submission_id, org_id)
        answer = self.repository.get_answer_by_id(answer_id)
        if not answer or str(answer.submission_id) != str(submission.id) or not answer.file_key:
            raise IntakeAnswerNotFound()
        return get_download_url(answer.file_key)

    def get_published_form(self, form_id, org_id) -> IntakeForm:
        form = self.get_form(form_id, org_id)
        if not form.is_published:
            raise IntakeFormNotPublished()
        return form

    def submit(
        self,
        org_id,
        submitted_by,
        form_id,
        answers: dict[str, str],
        files: dict[str, tuple[bytes, str, str]],
    ) -> IntakeSubmission:
        """
        answers: field_id (str) -> scalar text value, for non-file fields.
        files: field_id (str) -> (file_bytes, original_filename, content_type), for file fields.
        """
        form = self.get_published_form(form_id, org_id)

        # Pass 1: validate required fields + file constraints before touching the DB or R2.
        for field in form.fields:
            field_key = str(field.id)
            if field.field_type == IntakeFieldType.FILE:
                file_entry = files.get(field_key)
                if file_entry is None:
                    if field.is_required:
                        raise MissingRequiredIntakeAnswer()
                    continue
                file_bytes, _original_filename, content_type = file_entry
                if content_type not in ALLOWED_ANSWER_FILE_TYPES:
                    raise UnsupportedIntakeFileType()
                if len(file_bytes) > MAX_ANSWER_FILE_SIZE:
                    raise UnsupportedIntakeFileType()
            else:
                value = answers.get(field_key)
                if field.is_required and not value:
                    raise MissingRequiredIntakeAnswer()

        # Pass 2: malware-scan every file before persisting or uploading anything —
        # keeps the submission all-or-nothing (no partial rows/files on rejection).
        for field in form.fields:
            file_entry = files.get(str(field.id))
            if field.field_type == IntakeFieldType.FILE and file_entry is not None:
                scan_file(file_entry[0])

        # Pass 3: everything validated — persist the submission, uploading files as we go.
        submission = IntakeSubmission(org_id=org_id, form_id=form.id, submitted_by=submitted_by)
        self.repository.create_submission(submission)

        for field in form.fields:
            field_key = str(field.id)
            if field.field_type == IntakeFieldType.FILE:
                file_entry = files.get(field_key)
                if file_entry is None:
                    continue
                file_bytes, original_filename, content_type = file_entry
                file_key = f"intake/{org_id}/{uuid.uuid4()}-{original_filename}"
                upload_file(file_bytes, file_key, content_type)
                answer = IntakeSubmissionAnswer(
                    submission_id=submission.id,
                    field_id=field.id,
                    file_key=file_key,
                    original_filename=original_filename,
                    content_type=content_type,
                )
            else:
                value = answers.get(field_key)
                if value is None:
                    continue
                answer = IntakeSubmissionAnswer(submission_id=submission.id, field_id=field.id, value=value)
            self.repository.create_answer(answer)

        self.notifications.notify_many([
            {
                "recipient_type": RecipientType.STAFF,
                "recipient_id": staff.id,
                "type": "intake_submission.created",
                "title": f"New intake submission: {form.title}",
                "body": form.title,
                "target_type": "intake_submission",
                "target_id": submission.id,
            }
            for staff in self.auth_repository.list_by_org(org_id)
            if staff.is_active and str(staff.id) != str(submitted_by)
        ])
        self.db.commit()
        return submission
