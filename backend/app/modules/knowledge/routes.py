from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.modules.auth.dependencies import get_current_user, require_role
from app.modules.auth.models import User
from app.modules.auth.models.role import UserRole
from app.modules.knowledge.schemas import (
    CreateKnowledgeArticleRequest,
    UpdateKnowledgeArticleRequest,
    KnowledgeArticleResponse,
)
from app.modules.knowledge.service import KnowledgeService

router = APIRouter(prefix="/knowledge-articles", tags=["knowledge-articles"])

_AUTHORS = [UserRole.ADMIN, UserRole.LAWYER]


@router.post("", response_model=KnowledgeArticleResponse, status_code=201)
def create_knowledge_article(
    request: CreateKnowledgeArticleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_AUTHORS)),
):
    service = KnowledgeService(db)
    return service.create_article(current_user.org_id, current_user.id, request)


@router.get("", response_model=list[KnowledgeArticleResponse])
def list_knowledge_articles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = KnowledgeService(db)
    return service.list_articles(current_user.org_id)


@router.get("/{article_id}", response_model=KnowledgeArticleResponse)
def get_knowledge_article(
    article_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = KnowledgeService(db)
    return service.get_article(article_id, current_user.org_id)


@router.patch("/{article_id}", response_model=KnowledgeArticleResponse)
def update_knowledge_article(
    article_id: str,
    request: UpdateKnowledgeArticleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_AUTHORS)),
):
    service = KnowledgeService(db)
    return service.update_article(article_id, current_user.org_id, current_user.id, request)


@router.delete("/{article_id}", status_code=204)
def delete_knowledge_article(
    article_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(_AUTHORS)),
):
    service = KnowledgeService(db)
    service.delete_article(article_id, current_user.org_id, current_user.id)
