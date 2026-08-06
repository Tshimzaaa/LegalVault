from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.support_requests.models import SupportRequest


class SupportRequestRepository:

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, support_request_id) -> SupportRequest | None:
        return self.db.scalar(select(SupportRequest).where(SupportRequest.id == support_request_id))

    def list_by_firm(self, firm_id) -> list[SupportRequest]:
        return list(self.db.scalars(select(SupportRequest).where(SupportRequest.firm_id == firm_id)))

    def list_by_contact(self, contact_id) -> list[SupportRequest]:
        return list(self.db.scalars(select(SupportRequest).where(SupportRequest.contact_id == contact_id)))

    def list_recent_by_client(self, client_id, limit: int) -> list[SupportRequest]:
        statement = (
            select(SupportRequest)
            .where(SupportRequest.client_id == client_id)
            .order_by(SupportRequest.created_at.desc())
            .limit(limit)
        )
        return list(self.db.scalars(statement))

    def create(self, support_request: SupportRequest) -> SupportRequest:
        self.db.add(support_request)
        self.db.flush()
        return support_request
