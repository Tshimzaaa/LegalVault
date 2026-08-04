from sqlalchemy import select
from sqlalchemy.orm import Session
from app.modules.matters.models import MatterDocument

from app.modules.matters.models import Matter, MatterAssignment


class MatterRepository:

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, matter_id) -> Matter | None:
        return self.db.scalar(select(Matter).where(Matter.id == matter_id))

    def list_by_firm(self, firm_id) -> list[Matter]:
        return list(self.db.scalars(select(Matter).where(Matter.firm_id == firm_id)))

    def list_by_client(self, client_id) -> list[Matter]:
        return list(self.db.scalars(select(Matter).where(Matter.client_id == client_id)))

    def create(self, matter: Matter) -> Matter:
        self.db.add(matter)
        self.db.flush()
        return matter

    def create_assignment(self, assignment: MatterAssignment) -> MatterAssignment:
        self.db.add(assignment)
        self.db.flush()
        return assignment

    def get_assignment(self, matter_id, user_id, role_on_matter) -> MatterAssignment | None:
        return self.db.scalar(
            select(MatterAssignment).where(
                MatterAssignment.matter_id == matter_id,
                MatterAssignment.user_id == user_id,
                MatterAssignment.role_on_matter == role_on_matter,
            )
        )

    def list_assignments_for_matter(self, matter_id) -> list[MatterAssignment]:
        return list(
            self.db.scalars(select(MatterAssignment).where(MatterAssignment.matter_id == matter_id))
        )
    def count_matters_for_firm(self, firm_id) -> int:
        from sqlalchemy import func
        return self.db.scalar(select(func.count()).select_from(Matter).where(Matter.firm_id == firm_id))
    def create_document(self, document: MatterDocument) -> MatterDocument:
        self.db.add(document)
        self.db.flush()
        return document

    def get_document_by_id(self, document_id) -> MatterDocument | None:
        return self.db.scalar(select(MatterDocument).where(MatterDocument.id == document_id))

    def get_latest_version(self, matter_id, title: str) -> MatterDocument | None:
        statement = (
            select(MatterDocument)
            .where(MatterDocument.matter_id == matter_id, MatterDocument.title == title)
            .order_by(MatterDocument.version.desc())
        )
        return self.db.scalar(statement)

    def list_documents_for_matter(self, matter_id) -> list[MatterDocument]:
        return list(self.db.scalars(select(MatterDocument).where(MatterDocument.matter_id == matter_id)))

    def delete_document(self, document: MatterDocument):
        self.db.delete(document)
        self.db.flush()

    def delete_assignment(self, assignment: MatterAssignment):
        self.db.delete(assignment)
        self.db.flush()

    def delete_matter(self, matter: Matter):
        self.db.delete(matter)
        self.db.flush()