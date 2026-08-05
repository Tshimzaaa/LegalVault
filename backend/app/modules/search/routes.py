from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.search.schemas import SearchResponse
from app.modules.search.service import SearchService

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=SearchResponse)
def search(
    q: str = Query(min_length=1, max_length=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = SearchService(db)
    return service.search(current_user.firm_id, q)
