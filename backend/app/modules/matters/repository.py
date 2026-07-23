from sqlalchemy import select
from sqlalchemy.orm import Session

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
    