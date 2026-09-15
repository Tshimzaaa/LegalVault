from sqlalchemy import func, select
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from app.modules.auth.models import User
from app.modules.matters.models import Matter, MatterDocument
from app.modules.search.schemas import SearchResponse, SearchResultItem

RESULTS_PER_CATEGORY = 10


def _joined(*columns: ColumnElement) -> ColumnElement:
    """coalesce(col, '') || ' ' || coalesce(col, '') ... — deliberately not concat_ws(),
    which (like to_tsvector(regconfig, text)) is STABLE rather than IMMUTABLE in
    Postgres's own catalog, so it can't back an expression index. coalesce and || are
    genuinely immutable. Must match the corresponding migration's index expression
    (710a35471ab8) verbatim, or Postgres falls back to a full scan for `@@`."""
    parts = [func.coalesce(c, "") for c in columns]
    result = parts[0]
    for part in parts[1:]:
        result = result.concat(" ").concat(part)
    return result


def _tsvector(*columns: ColumnElement) -> ColumnElement:
    return func.immutable_english_tsvector(_joined(*columns))


class SearchService:

    def __init__(self, db: Session):
        self.db = db

    def search(self, org_id, query: str) -> SearchResponse:
        tsquery = func.websearch_to_tsquery("english", query)

        matter_vector = _tsvector(Matter.title, Matter.description)
        matters = self.db.scalars(
            select(Matter)
            .where(Matter.org_id == org_id, matter_vector.op("@@")(tsquery))
            .order_by(func.ts_rank(matter_vector, tsquery).desc())
            .limit(RESULTS_PER_CATEGORY)
        ).all()

        staff_vector = _tsvector(User.first_name, User.last_name, User.email)
        staff = self.db.scalars(
            select(User)
            .where(User.org_id == org_id, staff_vector.op("@@")(tsquery))
            .order_by(func.ts_rank(staff_vector, tsquery).desc())
            .limit(RESULTS_PER_CATEGORY)
        ).all()

        document_vector = _tsvector(MatterDocument.title, MatterDocument.original_filename)
        documents = self.db.scalars(
            select(MatterDocument)
            .join(Matter, MatterDocument.matter_id == Matter.id)
            .where(Matter.org_id == org_id, document_vector.op("@@")(tsquery))
            .order_by(func.ts_rank(document_vector, tsquery).desc())
            .limit(RESULTS_PER_CATEGORY)
        ).all()

        return SearchResponse(
            matters=[
                SearchResultItem(id=m.id, title=m.title, subtitle=m.status.value)
                for m in matters
            ],
            staff=[
                SearchResultItem(id=u.id, title=f"{u.first_name} {u.last_name}", subtitle=u.role.value)
                for u in staff
            ],
            documents=[
                SearchResultItem(id=d.id, title=d.title, subtitle=d.original_filename)
                for d in documents
            ],
        )
