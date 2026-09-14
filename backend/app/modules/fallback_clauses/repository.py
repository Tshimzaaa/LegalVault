from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.fallback_clauses.models import FallbackClause


class FallbackClauseRepository:

    def __init__(self, db: Session):
        self.db = db

    def create(self, clause: FallbackClause) -> FallbackClause:
        self.db.add(clause)
        self.db.flush()
        return clause

    def get_by_id(self, clause_id) -> FallbackClause | None:
        return self.db.scalar(select(FallbackClause).where(FallbackClause.id == clause_id))

    def list_by_org(self, org_id) -> list[FallbackClause]:
        statement = (
            select(FallbackClause)
            .where(FallbackClause.org_id == org_id)
            .order_by(FallbackClause.category, FallbackClause.name)
        )
        return list(self.db.scalars(statement))

    def delete(self, clause: FallbackClause):
        self.db.delete(clause)
        self.db.flush()
