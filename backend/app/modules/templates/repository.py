from sqlalchemy import or_, select
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

    # An org's own templates plus every shared (org_id IS NULL) platform template.
    def list_for_org(self, org_id) -> list[Template]:
        return list(
            self.db.scalars(
                select(Template).where(or_(Template.org_id == org_id, Template.org_id.is_(None)))
            )
        )

    # Strictly this org's own uploads — excludes shared templates. Use this (not
    # list_for_org) for anything that deletes/exports one org's data, so a single
    # org being removed never takes the platform-wide shared library down with it.
    def list_owned_by_org(self, org_id) -> list[Template]:
        return list(self.db.scalars(select(Template).where(Template.org_id == org_id)))

    # Owner console only — every shared template, regardless of org.
    def list_shared(self) -> list[Template]:
        return list(self.db.scalars(select(Template).where(Template.org_id.is_(None))))

    def get_latest_version(self, org_id, title: str) -> Template | None:
        statement = (
            select(Template)
            .where(Template.org_id == org_id, Template.title == title)
            .order_by(Template.version.desc())
        )
        return self.db.scalar(statement)

    def delete(self, template: Template):
        self.db.delete(template)
        self.db.flush()