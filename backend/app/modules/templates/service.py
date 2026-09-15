import uuid
from sqlalchemy.orm import Session

from app.modules.templates.repository import TemplateRepository
from app.modules.templates.models import Template
from app.modules.templates.schemas import UpdateTemplateRequest
from app.exceptions.templates import TemplateNotFound, UnsupportedFileType
from app.exceptions.malware import MalwareDetected
from app.core.storage import upload_file, get_download_url, delete_file
from app.core.malware_scan import scan_file
from app.modules.audit.service import AuditService
from app.modules.audit.models import ActorType
from app.modules.audit import actions as audit_actions

ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # .docx
    "application/msword",  # .doc
    "text/plain",  # .txt
}


class TemplateService:

    def __init__(self, db: Session):
        self.db = db
        self.repository = TemplateRepository(db)
        self.audit = AuditService(db)

    def upload_template(
        self,
        org_id,
        actor_id,
        title: str,
        description: str | None,
        category: str,
        file_bytes: bytes,
        original_filename: str,
        content_type: str,
        actor_type: ActorType = ActorType.STAFF,
    ) -> Template:
        if content_type not in ALLOWED_CONTENT_TYPES:
            raise UnsupportedFileType()

        try:
            scan_file(file_bytes)
        except MalwareDetected:
            self.audit.log(
                actor_type=actor_type,
                actor_id=actor_id,
                org_id=org_id,
                action=audit_actions.FILE_UPLOAD_BLOCKED_MALWARE,
                target_type="template",
                target_id=None,
                details={"title": title, "original_filename": original_filename},
            )
            self.db.commit()
            raise

        latest = self.repository.get_latest_version(org_id, title)
        next_version = (latest.version + 1) if latest else 1

        file_key = f"templates/{org_id or 'shared'}/{uuid.uuid4()}-{original_filename}"
        upload_file(file_bytes, file_key, content_type)

        template = Template(
            org_id=org_id,
            title=title,
            description=description,
            category=category,
            file_key=file_key,
            original_filename=original_filename,
            content_type=content_type,
            version=next_version,
        )
        self.repository.create(template)

        self.audit.log(
            actor_type=actor_type,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.TEMPLATE_UPLOADED,
            target_type="template",
            target_id=template.id,
            details={"title": template.title, "version": template.version},
        )
        self.db.commit()
        return template

    def list_templates(self, org_id) -> list[Template]:
        return self.repository.list_for_org(org_id)

    def get_download_link(self, template_id, org_id) -> str:
        template = self.repository.get_by_id(template_id)
        # A shared template (org_id is None) is downloadable by any org; an
        # org-owned one only by its own org.
        if not template or (template.org_id is not None and str(template.org_id) != str(org_id)):
            raise TemplateNotFound()
        return get_download_url(template.file_key)

    def update_template(self, template_id, org_id, actor_id, request: UpdateTemplateRequest) -> Template:
        template = self.repository.get_by_id(template_id)
        if not template or str(template.org_id) != str(org_id):
            raise TemplateNotFound()

        updates = request.model_dump(exclude_unset=True)
        for field, value in updates.items():
            setattr(template, field, value)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.TEMPLATE_UPDATED,
            target_type="template",
            target_id=template.id,
            details=updates,
        )
        self.db.commit()
        return template

    def delete_template(self, template_id, org_id, actor_id, actor_type: ActorType = ActorType.STAFF) -> None:
        template = self.repository.get_by_id(template_id)
        if not template or str(template.org_id) != str(org_id):
            raise TemplateNotFound()

        delete_file(template.file_key)
        self.repository.delete(template)

        self.audit.log(
            actor_type=actor_type,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.TEMPLATE_DELETED,
            target_type="template",
            target_id=template.id,
            details={"title": template.title, "version": template.version},
        )
        self.db.commit()