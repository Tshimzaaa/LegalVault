import uuid
from sqlalchemy.orm import Session

from app.modules.intake.repository import IntakeRepository
from app.modules.intake.models import (
    IntakeForm,
    IntakeFieldType,
    IntakeSubmission,
    IntakeSubmissionAnswer,
    IntakeSubmissionStatus,
)
from app.modules.intake.schemas import (
    UpdateIntakeSubmissionStatusRequest,
    ConvertIntakeSubmissionRequest,
)
from app.exceptions.intake import (
    IntakeFormNotFound,
    IntakeSubmissionNotFound,
    IntakeAnswerNotFound,
    IntakeFormNotPublished,
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

    # ---- Forms (staff: read-only — see routes.py's note on why there's no builder) ----

    def get_form(self, form_id, org_id) -> IntakeForm:
        form = self.repository.get_form_by_id(form_id)
        if not form or str(form.org_id) != str(org_id):
            raise IntakeFormNotFound()
        return form

    def list_forms(self, org_id) -> list[IntakeForm]:
        return self.repository.list_forms_by_org(org_id)

    # ---- Submissions (staff triage) ----

    def get_submission(self, submission_id, org_id) -> IntakeSubmission:
        submission = self.repository.get_submission_by_id(submission_id)
        if not submission or str(submission.org_id) != str(org_id):
            raise IntakeSubmissionNotFound()
        return submission

    def list_submissions(self, org_id) -> list[IntakeSubmission]:
        return self.repository.list_submissions_by_org(org_id)

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

    def convert_to_matter(
        self, submission_id, org_id, actor_id, request: ConvertIntakeSubmissionRequest
    ) -> IntakeSubmission:
        submission = self.get_submission(submission_id, org_id)
        form = self.get_form(submission.form_id, org_id)

        client = self.client_repository.get_client_by_id(submission.client_id)
        if not client or str(client.org_id) != str(org_id):
            raise ClientNotFoundForMatter()

        title = request.matter_title or f"{client.company_name} – {form.title}"

        matter_service = MatterService(self.db)
        matter = matter_service.create_matter(
            org_id,
            actor_id,
            CreateMatterRequest(client_id=submission.client_id, title=title, description=None, due_date=None),
        )

        submission.converted_matter_id = matter.id
        submission.status = IntakeSubmissionStatus.CONVERTED
        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.INTAKE_SUBMISSION_CONVERTED,
            target_type="intake_submission",
            target_id=submission.id,
            details={"matter_id": str(matter.id)},
        )
        self.db.commit()
        return submission

    def get_answer_download_link(self, submission_id, org_id, answer_id) -> str:
        submission = self.get_submission(submission_id, org_id)
        answer = self.repository.get_answer_by_id(answer_id)
        if not answer or str(answer.submission_id) != str(submission.id) or not answer.file_key:
            raise IntakeAnswerNotFound()
        return get_download_url(answer.file_key)

    # ---- Client-portal ----

    def list_published_forms(self, org_id) -> list[IntakeForm]:
        return self.repository.list_published_forms_by_org(org_id)

    def get_published_form(self, form_id, org_id) -> IntakeForm:
        form = self.get_form(form_id, org_id)
        if not form.is_published:
            raise IntakeFormNotPublished()
        return form

    def submit(
        self,
        org_id,
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
        submission = IntakeSubmission(org_id=org_id, form_id=form.id, client_id=client_id, contact_id=contact_id)
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
