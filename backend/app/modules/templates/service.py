import uuid
from sqlalchemy.orm import Session

from app.modules.templates.repository import TemplateRepository
from app.modules.templates.models import Template
from app.modules.templates.schemas import UpdateTemplateRequest
from app.exceptions.templates import TemplateNotFound, UnsupportedFileType
from app.core.storage import upload_file, get_download_url
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
        firm_id,
        actor_id,
        title: str,
        description: str | None,
        category: str,
        file_bytes: bytes,
        original_filename: str,
        content_type: str,
    ) -> Template:
        if content_type not in ALLOWED_CONTENT_TYPES:
            raise UnsupportedFileType()

        latest = self.repository.get_latest_version(firm_id, title)
        next_version = (latest.version + 1) if latest else 1

        file_key = f"templates/{firm_id}/{uuid.uuid4()}-{original_filename}"
        upload_file(file_bytes, file_key, content_type)

        template = Template(
            firm_id=firm_id,
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
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            firm_id=firm_id,
            action=audit_actions.TEMPLATE_UPLOADED,
            target_type="template",
            target_id=template.id,
            details={"title": template.title, "version": template.version},
        )
        self.db.commit()
        return template

    def list_templates(self, firm_id) -> list[Template]:
        return self.repository.list_by_firm(firm_id)

    def get_download_link(self, template_id, firm_id) -> str:
        template = self.repository.get_by_id(template_id)
        if not template or str(template.firm_id) != str(firm_id):
            raise TemplateNotFound()
        return get_download_url(template.file_key)

    def update_template(self, template_id, firm_id, actor_id, request: UpdateTemplateRequest) -> Template:
        template = self.repository.get_by_id(template_id)
        if not template or str(template.firm_id) != str(firm_id):
            raise TemplateNotFound()

        updates = request.model_dump(exclude_unset=True)
        for field, value in updates.items():
            setattr(template, field, value)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            firm_id=firm_id,
            action=audit_actions.TEMPLATE_UPDATED,
            target_type="template",
            target_id=template.id,
            details=updates,
        )
        self.db.commit()
        return template