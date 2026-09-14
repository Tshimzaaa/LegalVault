from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.knowledge.models import KnowledgeArticle


class KnowledgeRepository:

    def __init__(self, db: Session):
        self.db = db

    def create(self, article: KnowledgeArticle) -> KnowledgeArticle:
        self.db.add(article)
        self.db.flush()
        return article

    def get_by_id(self, article_id) -> KnowledgeArticle | None:
        return self.db.scalar(select(KnowledgeArticle).where(KnowledgeArticle.id == article_id))

    def list_by_org(self, org_id) -> list[KnowledgeArticle]:
        return list(self.db.scalars(select(KnowledgeArticle).where(KnowledgeArticle.org_id == org_id)))

    def list_published_by_org(self, org_id) -> list[KnowledgeArticle]:
        return list(
            self.db.scalars(
                select(KnowledgeArticle).where(
                    KnowledgeArticle.org_id == org_id,
                    KnowledgeArticle.is_published.is_(True),
                )
            )
        )

    def delete(self, article: KnowledgeArticle):
        self.db.delete(article)
        self.db.flush()
