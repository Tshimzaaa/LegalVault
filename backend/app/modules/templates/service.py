import uuid
from sqlalchemy.orm import Session

from app.modules.templates.repository import TemplateRepository
from app.modules.templates.models import Template
from app.exceptions.templates import TemplateNotFound, UnsupportedFileType
from app.core.storage import upload_file, get_download_url

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

    def upload_template(
        self,
        firm_id,
        title: str,
        description: str | None,
        category: str,
        file_bytes: bytes,
        original_filename: str,
        content_type: str,
    ) -> Template:
        if content_type not in ALLOWED_CONTENT_TYPES:
            raise UnsupportedFileType()

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
        )
        self.repository.create(template)
        self.db.commit()
        return template

    def list_templates(self, firm_id) -> list[Template]:
        return self.repository.list_by_firm(firm_id)

    def get_download_link(self, template_id, firm_id) -> str:
        template = self.repository.get_by_id(template_id)
        if not template or str(template.firm_id) != str(firm_id):
            raise TemplateNotFound()
        return get_download_url(template.file_key)