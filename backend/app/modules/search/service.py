from sqlalchemy import func, select
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from app.modules.auth.models import User
from app.modules.clients.models import Client, ClientContact
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

    def search(self, firm_id, query: str) -> SearchResponse:
        tsquery = func.websearch_to_tsquery("english", query)

        client_vector = _tsvector(Client.company_name)
        clients = self.db.scalars(
            select(Client)
            .where(Client.firm_id == firm_id, client_vector.op("@@")(tsquery))
            .order_by(func.ts_rank(client_vector, tsquery).desc())
            .limit(RESULTS_PER_CATEGORY)
        ).all()

        contact_vector = _tsvector(ClientContact.first_name, ClientContact.last_name, ClientContact.email)
        contacts = self.db.scalars(
            select(ClientContact)
            .join(Client, ClientContact.client_id == Client.id)
            .where(Client.firm_id == firm_id, contact_vector.op("@@")(tsquery))
            .order_by(func.ts_rank(contact_vector, tsquery).desc())
            .limit(RESULTS_PER_CATEGORY)
        ).all()

        matter_vector = _tsvector(Matter.title, Matter.description)
        matters = self.db.scalars(
            select(Matter)
            .where(Matter.firm_id == firm_id, matter_vector.op("@@")(tsquery))
            .order_by(func.ts_rank(matter_vector, tsquery).desc())
            .limit(RESULTS_PER_CATEGORY)
        ).all()

        staff_vector = _tsvector(User.first_name, User.last_name, User.email)
        staff = self.db.scalars(
            select(User)
            .where(User.firm_id == firm_id, staff_vector.op("@@")(tsquery))
            .order_by(func.ts_rank(staff_vector, tsquery).desc())
            .limit(RESULTS_PER_CATEGORY)
        ).all()

        document_vector = _tsvector(MatterDocument.title, MatterDocument.original_filename)
        documents = self.db.scalars(
            select(MatterDocument)
            .join(Matter, MatterDocument.matter_id == Matter.id)
            .where(Matter.firm_id == firm_id, document_vector.op("@@")(tsquery))
            .order_by(func.ts_rank(document_vector, tsquery).desc())
            .limit(RESULTS_PER_CATEGORY)
        ).all()

        return SearchResponse(
            clients=[
                SearchResultItem(id=c.id, title=c.company_name)
                for c in clients
            ],
            contacts=[
                SearchResultItem(id=c.id, title=f"{c.first_name} {c.last_name}", subtitle=c.email)
                for c in contacts
            ],
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
