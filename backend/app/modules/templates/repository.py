from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.templates.models import Template


class TemplateRepository:

    def __init__(self, db: Session):
        self.db = db

    def create(self, template: Template) -> Template:
        self.db.add(template)
        self.db.flush()
        return template

    def get_by_id(self, template_id) -> Template | None:
        return self.db.scalar(select(Template).where(Template.id == template_id))

    def list_by_firm(self, firm_id) -> list[Template]:
        return list(self.db.scalars(select(Template).where(Template.firm_id == firm_id)))