from sqlalchemy.orm import Session

from app.modules.knowledge.repository import KnowledgeRepository
from app.modules.knowledge.models import KnowledgeArticle
from app.modules.knowledge.schemas import CreateKnowledgeArticleRequest, UpdateKnowledgeArticleRequest
from app.exceptions.knowledge import KnowledgeArticleNotFound
from app.modules.audit.service import AuditService
from app.modules.audit.models import ActorType
from app.modules.audit import actions as audit_actions


class KnowledgeService:

    def __init__(self, db: Session):
        self.db = db
        self.repository = KnowledgeRepository(db)
        self.audit = AuditService(db)

    def create_article(self, firm_id, actor_id, request: CreateKnowledgeArticleRequest) -> KnowledgeArticle:
        article = KnowledgeArticle(
            firm_id=firm_id,
            title=request.title,
            category=request.category,
            content=request.content,
            is_published=request.is_published,
            created_by=actor_id,
        )
        self.repository.create(article)
        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            firm_id=firm_id,
            action=audit_actions.KNOWLEDGE_ARTICLE_CREATED,
            target_type="knowledge_article",
            target_id=article.id,
            details={"title": article.title},
        )
        self.db.commit()
        return article

    def get_article(self, article_id, firm_id) -> KnowledgeArticle:
        article = self.repository.get_by_id(article_id)
        if not article or str(article.firm_id) != str(firm_id):
            raise KnowledgeArticleNotFound()
        return article

    def list_articles(self, firm_id) -> list[KnowledgeArticle]:
        return self.repository.list_by_firm(firm_id)

    def update_article(
        self, article_id, firm_id, actor_id, request: UpdateKnowledgeArticleRequest
    ) -> KnowledgeArticle:
        article = self.get_article(article_id, firm_id)
        updates = request.model_dump(exclude_unset=True)
        for field, value in updates.items():
            setattr(article, field, value)
        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            firm_id=firm_id,
            action=audit_actions.KNOWLEDGE_ARTICLE_UPDATED,
            target_type="knowledge_article",
            target_id=article.id,
            details=updates,
        )
        self.db.commit()
        return article

    def delete_article(self, article_id, firm_id, actor_id) -> None:
        article = self.get_article(article_id, firm_id)
        title = article.title
        self.repository.delete(article)
        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            firm_id=firm_id,
            action=audit_actions.KNOWLEDGE_ARTICLE_DELETED,
            target_type="knowledge_article",
            target_id=article_id,
            details={"title": title},
        )
        self.db.commit()

    def list_published_articles(self, firm_id) -> list[KnowledgeArticle]:
        return self.repository.list_published_by_firm(firm_id)

    def get_published_article(self, article_id, firm_id) -> KnowledgeArticle:
        article = self.get_article(article_id, firm_id)
        if not article.is_published:
            raise KnowledgeArticleNotFound()
        return article
