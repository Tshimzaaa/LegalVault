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
    CreateIntakeFormRequest,
    UpdateIntakeFormRequest,
    IntakeFormFieldCreateRequest,
    IntakeFormFieldUpdateRequest,
    ReorderFieldsRequest,
    UpdateIntakeSubmissionStatusRequest,
    ConvertIntakeSubmissionRequest,
)
from app.exceptions.intake import (
    IntakeFormNotFound,
    IntakeFieldNotFound,
    IntakeSubmissionNotFound,
    IntakeAnswerNotFound,
    IntakeFormNotPublished,
    IntakeFormHasSubmissions,
    IntakeFieldLocked,
    MissingRequiredIntakeAnswer,
    UnsupportedIntakeFileType,
)
from app.exceptions.matters import ClientNotFoundForMatter
from app.core.storage import upload_file, get_download_url
from app.core.malware_scan import scan_file
from app.modules.audit.service import AuditService
from app.modules.audit.models import ActorType
from app.modules.audit import actions as audit_actions
from app.modules.notifications.service import NotificationService
from app.modules.notifications.models import RecipientType
from app.modules.auth.repository import AuthRepository
from app.modules.clients.repository import ClientRepository
from app.modules.matters.service import MatterService
from app.modules.matters.schemas import CreateMatterRequest

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
        self.client_repository = ClientRepository(db)
        self.auth_repository = AuthRepository(db)
        self.audit = AuditService(db)
        self.notifications = NotificationService(db)

    # ---- Forms (staff) ----

    def create_form(self, firm_id, actor_id, request: CreateIntakeFormRequest) -> IntakeForm:
        form = IntakeForm(
            firm_id=firm_id,
            title=request.title,
            description=request.description,
            created_by=actor_id,
        )
        self.repository.create_form(form)
        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            firm_id=firm_id,
            action=audit_actions.INTAKE_FORM_CREATED,
            target_type="intake_form",
            target_id=form.id,
            details={"title": form.title},
        )
        self.db.commit()
        return form

    def get_form(self, form_id, firm_id) -> IntakeForm:
        form = self.repository.get_form_by_id(form_id)
        if not form or str(form.firm_id) != str(firm_id):
            raise IntakeFormNotFound()
        return form

    def list_forms(self, firm_id) -> list[IntakeForm]:
        return self.repository.list_forms_by_firm(firm_id)

    def update_form(self, form_id, firm_id, actor_id, request: UpdateIntakeFormRequest) -> IntakeForm:
        form = self.get_form(form_id, firm_id)
        updates = request.model_dump(exclude_unset=True)
        for field, value in updates.items():
            setattr(form, field, value)
        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            firm_id=firm_id,
            action=audit_actions.INTAKE_FORM_UPDATED,
            target_type="intake_form",
            target_id=form.id,
            details=updates,
        )
        self.db.commit()
        return form

    def delete_form(self, form_id, firm_id, actor_id) -> None:
        form = self.get_form(form_id, firm_id)
        if self.repository.count_submissions_for_form(form_id) > 0:
            raise IntakeFormHasSubmissions()

        title = form.title
        self.repository.delete_form(form)
        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            firm_id=firm_id,
            action=audit_actions.INTAKE_FORM_DELETED,
            target_type="intake_form",
            target_id=form_id,
            details={"title": title},
        )
        self.db.commit()

    # ---- Fields (staff) ----

    def add_field(self, form_id, firm_id, actor_id, request: IntakeFormFieldCreateRequest) -> IntakeFormField:
        form = self.get_form(form_id, firm_id)
        next_order = self.repository.max_display_order(form_id) + 1
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
            firm_id=firm_id,
            action=audit_actions.INTAKE_FIELD_ADDED,
            target_type="intake_form_field",
            target_id=field.id,
            details={"form_id": str(form_id), "label": field.label},
        )
        self.db.commit()
        return field

    def _get_field_for_form(self, form_id, firm_id, field_id) -> IntakeFormField:
        self.get_form(form_id, firm_id)  # 404s if the form doesn't exist or belongs to another firm
        field = self.repository.get_field_by_id(field_id)
        if not field or str(field.form_id) != str(form_id):
            raise IntakeFieldNotFound()
        return field

    def update_field(
        self, form_id, firm_id, actor_id, field_id, request: IntakeFormFieldUpdateRequest
    ) -> IntakeFormField:
        field = self._get_field_for_form(form_id, firm_id, field_id)
        updates = request.model_dump(exclude_unset=True)

        changes_type = "field_type" in updates and updates["field_type"] != field.field_type
        if changes_type and self.repository.count_submissions_for_form(form_id) > 0:
            raise IntakeFieldLocked()

        for key, value in updates.items():
            setattr(field, key, value)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            firm_id=firm_id,
            action=audit_actions.INTAKE_FIELD_UPDATED,
            target_type="intake_form_field",
            target_id=field.id,
            details=updates,
        )
        self.db.commit()
        return field

    def delete_field(self, form_id, firm_id, actor_id, field_id) -> None:
        field = self._get_field_for_form(form_id, firm_id, field_id)
        if self.repository.count_submissions_for_form(form_id) > 0:
            raise IntakeFieldLocked()

        label = field.label
        self.repository.delete_field(field)
        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            firm_id=firm_id,
            action=audit_actions.INTAKE_FIELD_REMOVED,
            target_type="intake_form_field",
            target_id=field_id,
            details={"form_id": str(form_id), "label": label},
        )
        self.db.commit()

    def reorder_fields(self, form_id, firm_id, actor_id, request: ReorderFieldsRequest) -> list[IntakeFormField]:
        form = self.get_form(form_id, firm_id)
        fields_by_id = {field.id: field for field in form.fields}

        if set(request.field_ids) != set(fields_by_id.keys()):
            raise IntakeFieldNotFound()

        for order, field_id in enumerate(request.field_ids):
            fields_by_id[field_id].display_order = order

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            firm_id=firm_id,
            action=audit_actions.INTAKE_FIELD_UPDATED,
            target_type="intake_form",
            target_id=form.id,
            details={"reordered": [str(fid) for fid in request.field_ids]},
        )
        self.db.commit()
        return self.repository.list_fields_by_form(form_id)

    # ---- Submissions (staff triage) ----

    def get_submission(self, submission_id, firm_id) -> IntakeSubmission:
        submission = self.repository.get_submission_by_id(submission_id)
        if not submission or str(submission.firm_id) != str(firm_id):
            raise IntakeSubmissionNotFound()
        return submission

    def list_submissions(self, firm_id) -> list[IntakeSubmission]:
        return self.repository.list_submissions_by_firm(firm_id)

    def update_submission_status(
        self, submission_id, firm_id, actor_id, request: UpdateIntakeSubmissionStatusRequest
    ) -> IntakeSubmission:
        submission = self.get_submission(submission_id, firm_id)
        submission.status = request.status
        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            firm_id=firm_id,
            action=audit_actions.INTAKE_SUBMISSION_STATUS_UPDATED,
            target_type="intake_submission",
            target_id=submission.id,
            details={"status": request.status.value},
        )
        self.db.commit()
        return submission

    def convert_to_matter(
        self, submission_id, firm_id, actor_id, request: ConvertIntakeSubmissionRequest
    ) -> IntakeSubmission:
        submission = self.get_submission(submission_id, firm_id)
        form = self.get_form(submission.form_id, firm_id)

        client = self.client_repository.get_client_by_id(submission.client_id)
        if not client or str(client.firm_id) != str(firm_id):
            raise ClientNotFoundForMatter()

        title = request.matter_title or f"{client.company_name} – {form.title}"

        matter_service = MatterService(self.db)
        matter = matter_service.create_matter(
            firm_id,
            actor_id,
            CreateMatterRequest(client_id=submission.client_id, title=title, description=None, due_date=None),
        )

        submission.converted_matter_id = matter.id
        submission.status = IntakeSubmissionStatus.CONVERTED
        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            firm_id=firm_id,
            action=audit_actions.INTAKE_SUBMISSION_CONVERTED,
            target_type="intake_submission",
            target_id=submission.id,
            details={"matter_id": str(matter.id)},
        )
        self.db.commit()
        return submission

    def get_answer_download_link(self, submission_id, firm_id, answer_id) -> str:
        submission = self.get_submission(submission_id, firm_id)
        answer = self.repository.get_answer_by_id(answer_id)
        if not answer or str(answer.submission_id) != str(submission.id) or not answer.file_key:
            raise IntakeAnswerNotFound()
        return get_download_url(answer.file_key)

    # ---- Client-portal ----

    def list_published_forms(self, firm_id) -> list[IntakeForm]:
        return self.repository.list_published_forms_by_firm(firm_id)

    def get_published_form(self, form_id, firm_id) -> IntakeForm:
        form = self.get_form(form_id, firm_id)
        if not form.is_published:
            raise IntakeFormNotPublished()
        return form

    def submit(
        self,
        firm_id,
        client_id,
        contact_id,
        form_id,
        answers: dict[str, str],
        files: dict[str, tuple[bytes, str, str]],
    ) -> IntakeSubmission:
        """
        answers: field_id (str) -> scalar text value, for non-file fields.
        files: field_id (str) -> (file_bytes, original_filename, content_type), for file fields.
        """
        form = self.get_published_form(form_id, firm_id)

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
        submission = IntakeSubmission(firm_id=firm_id, form_id=form.id, client_id=client_id, contact_id=contact_id)
        self.repository.create_submission(submission)

        for field in form.fields:
            field_key = str(field.id)
            if field.field_type == IntakeFieldType.FILE:
                file_entry = files.get(field_key)
                if file_entry is None:
                    continue
                file_bytes, original_filename, content_type = file_entry
                file_key = f"intake/{firm_id}/{uuid.uuid4()}-{original_filename}"
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
            for staff in self.auth_repository.list_by_firm(firm_id)
            if staff.is_active
        ])
        self.db.commit()
        return submission

    def list_my_submissions(self, contact_id) -> list[IntakeSubmission]:
        return self.repository.list_submissions_by_contact(contact_id)

    def get_my_submission(self, submission_id, contact_id) -> IntakeSubmission:
        submission = self.repository.get_submission_by_id(submission_id)
        if not submission or str(submission.contact_id) != str(contact_id):
            raise IntakeSubmissionNotFound()
        return submission
