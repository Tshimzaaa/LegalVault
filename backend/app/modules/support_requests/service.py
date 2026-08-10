from sqlalchemy.orm import Session

from app.modules.support_requests.repository import SupportRequestRepository
from app.modules.support_requests.models import SupportRequest
from app.modules.support_requests.schemas import (
    CreateSupportRequestRequest,
    UpdateSupportRequestStatusRequest,
)
from app.exceptions.support_requests import SupportRequestNotFound
from app.modules.auth.repository import AuthRepository
from app.modules.notifications.service import NotificationService
from app.modules.notifications.models import RecipientType


class SupportRequestService:

    def __init__(self, db: Session):
        self.db = db
        self.repository = SupportRequestRepository(db)
        self.auth_repository = AuthRepository(db)
        self.notifications = NotificationService(db)

    def create_support_request(
        self, firm_id, client_id, contact_id, request: CreateSupportRequestRequest
    ) -> SupportRequest:
        support_request = SupportRequest(
            firm_id=firm_id,
            client_id=client_id,
            contact_id=contact_id,
            request_type=request.request_type,
            counterparty=request.counterparty,
            priority=request.priority,
            needed_by=request.needed_by,
            description=request.description,
            reference_documents=request.reference_documents,
        )
        self.repository.create(support_request)

        preview = request.description if len(request.description) <= 120 else f"{request.description[:117]}..."
        self.notifications.notify_many([
            {
                "recipient_type": RecipientType.STAFF,
                "recipient_id": staff.id,
                "type": "support_request.created",
                "title": f"New support request: {request.request_type.value.replace('_', ' ').title()}",
                "body": preview,
                "target_type": "support_request",
                "target_id": support_request.id,
            }
            for staff in self.auth_repository.list_by_firm(firm_id)
            if staff.is_active
        ])
        self.db.commit()
        return support_request

    def list_my_support_requests(self, contact_id) -> list[SupportRequest]:
        return self.repository.list_by_contact(contact_id)

    def list_support_requests_for_firm(self, firm_id) -> list[SupportRequest]:
        return self.repository.list_by_firm(firm_id)

    def update_status(self, support_request_id, firm_id, request: UpdateSupportRequestStatusRequest) -> SupportRequest:
        support_request = self.repository.get_by_id(support_request_id)
        if not support_request or str(support_request.firm_id) != str(firm_id):
            raise SupportRequestNotFound()

        support_request.status = request.status
        self.db.commit()
        return support_request
