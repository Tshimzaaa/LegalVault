from sqlalchemy.orm import Session

from app.modules.fallback_clauses.repository import FallbackClauseRepository
from app.modules.fallback_clauses.models import FallbackClause
from app.modules.fallback_clauses.schemas import CreateFallbackClauseRequest, UpdateFallbackClauseRequest
from app.exceptions.fallback_clauses import FallbackClauseNotFound
from app.modules.audit.service import AuditService
from app.modules.audit.models import ActorType
from app.modules.audit import actions as audit_actions


class FallbackClauseService:

    def __init__(self, db: Session):
        self.db = db
        self.repository = FallbackClauseRepository(db)
        self.audit = AuditService(db)

    def create_clause(self, firm_id, actor_id, request: CreateFallbackClauseRequest) -> FallbackClause:
        clause = FallbackClause(
            firm_id=firm_id,
            name=request.name,
            category=request.category,
            description=request.description,
            content=request.content,
            pre_approved=request.pre_approved,
        )
        self.repository.create(clause)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            firm_id=firm_id,
            action=audit_actions.FALLBACK_CLAUSE_CREATED,
            target_type="fallback_clause",
            target_id=clause.id,
            details={"name": clause.name, "category": clause.category},
        )
        self.db.commit()
        return clause

    def list_clauses(self, firm_id) -> list[FallbackClause]:
        return self.repository.list_by_firm(firm_id)

    def update_clause(self, clause_id, firm_id, actor_id, request: UpdateFallbackClauseRequest) -> FallbackClause:
        clause = self.repository.get_by_id(clause_id)
        if not clause or str(clause.firm_id) != str(firm_id):
            raise FallbackClauseNotFound()

        updates = request.model_dump(exclude_unset=True)
        for field, value in updates.items():
            setattr(clause, field, value)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            firm_id=firm_id,
            action=audit_actions.FALLBACK_CLAUSE_UPDATED,
            target_type="fallback_clause",
            target_id=clause.id,
            details=updates,
        )
        self.db.commit()
        return clause

    def delete_clause(self, clause_id, firm_id, actor_id) -> None:
        clause = self.repository.get_by_id(clause_id)
        if not clause or str(clause.firm_id) != str(firm_id):
            raise FallbackClauseNotFound()

        self.repository.delete(clause)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            firm_id=firm_id,
            action=audit_actions.FALLBACK_CLAUSE_DELETED,
            target_type="fallback_clause",
            target_id=clause.id,
            details={"name": clause.name},
        )
        self.db.commit()
