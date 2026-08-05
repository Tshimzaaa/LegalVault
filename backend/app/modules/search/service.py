from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.modules.auth.models import User
from app.modules.clients.models import Client, ClientContact
from app.modules.matters.models import Matter, MatterDocument
from app.modules.search.schemas import SearchResponse, SearchResultItem

RESULTS_PER_CATEGORY = 10


class SearchService:

    def __init__(self, db: Session):
        self.db = db

    def search(self, firm_id, query: str) -> SearchResponse:
        pattern = f"%{query}%"

        clients = self.db.scalars(
            select(Client)
            .where(Client.firm_id == firm_id, Client.company_name.ilike(pattern))
            .limit(RESULTS_PER_CATEGORY)
        ).all()

        contacts = self.db.scalars(
            select(ClientContact)
            .join(Client, ClientContact.client_id == Client.id)
            .where(
                Client.firm_id == firm_id,
                or_(
                    ClientContact.first_name.ilike(pattern),
                    ClientContact.last_name.ilike(pattern),
                    ClientContact.email.ilike(pattern),
                ),
            )
            .limit(RESULTS_PER_CATEGORY)
        ).all()

        matters = self.db.scalars(
            select(Matter)
            .where(
                Matter.firm_id == firm_id,
                or_(
                    Matter.title.ilike(pattern),
                    Matter.description.ilike(pattern),
                ),
            )
            .limit(RESULTS_PER_CATEGORY)
        ).all()

        staff = self.db.scalars(
            select(User)
            .where(
                User.firm_id == firm_id,
                or_(
                    User.first_name.ilike(pattern),
                    User.last_name.ilike(pattern),
                    User.email.ilike(pattern),
                ),
            )
            .limit(RESULTS_PER_CATEGORY)
        ).all()

        documents = self.db.scalars(
            select(MatterDocument)
            .join(Matter, MatterDocument.matter_id == Matter.id)
            .where(
                Matter.firm_id == firm_id,
                or_(
                    MatterDocument.title.ilike(pattern),
                    MatterDocument.original_filename.ilike(pattern),
                ),
            )
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
