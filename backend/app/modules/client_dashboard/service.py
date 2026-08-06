from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session

from app.modules.matters.repository import MatterRepository
from app.modules.matters.models import MatterStatus
from app.modules.support_requests.repository import SupportRequestRepository
from app.modules.client_dashboard.schemas import (
    ClientDashboardSummaryResponse,
    ContractBreakdown,
    RecentAction,
)

RECENT_ACTIONS_LIMIT = 8


class ClientDashboardService:

    def __init__(self, db: Session):
        self.db = db
        self.matter_repository = MatterRepository(db)
        self.support_repository = SupportRequestRepository(db)

    def get_summary(self, client_id) -> ClientDashboardSummaryResponse:
        matters = [m for m in self.matter_repository.list_by_client(client_id) if m.is_visible_to_client]
        today = date.today()

        open_matters = sum(1 for m in matters if m.status not in (MatterStatus.CLOSED, MatterStatus.DECLINED))

        signed = pending = expired = 0
        for m in matters:
            if m.status in (MatterStatus.SIGNED, MatterStatus.CLOSED):
                signed += 1
            elif m.status == MatterStatus.DECLINED:
                expired += 1
            elif m.due_date and m.due_date < today:
                expired += 1
            else:
                pending += 1

        events: list[tuple[datetime, str]] = []

        for matter in matters:
            events.append((matter.created_at, f'Matter created: "{matter.title}"'))
            # created_at/updated_at are set via independent `datetime.now()` calls at insert time (see
            # BaseModel), so a never-edited row can differ by a few microseconds — a strict != would
            # spuriously treat every fresh matter as "just changed status". Require a real gap instead.
            if matter.updated_at - matter.created_at > timedelta(seconds=1):
                status_label = matter.status.value.replace("_", " ").title()
                events.append((matter.updated_at, f'"{matter.title}" — status is now {status_label}'))

        for document, matter in self.matter_repository.list_recent_documents_for_client(client_id, RECENT_ACTIONS_LIMIT):
            events.append((document.created_at, f'Document uploaded: "{document.title}" on "{matter.title}"'))

        for message, matter in self.matter_repository.list_recent_messages_for_client(client_id, RECENT_ACTIONS_LIMIT):
            preview = message.body if len(message.body) <= 80 else f"{message.body[:77]}..."
            events.append((message.created_at, f'{message.author_name} on "{matter.title}": {preview}'))

        for support_request in self.support_repository.list_recent_by_client(client_id, RECENT_ACTIONS_LIMIT):
            type_label = support_request.request_type.value.replace("_", " ").title()
            events.append((support_request.created_at, f"{type_label} request submitted"))

        events.sort(key=lambda e: e[0], reverse=True)
        recent_actions = [
            RecentAction(text=text, occurred_at=occurred_at) for occurred_at, text in events[:RECENT_ACTIONS_LIMIT]
        ]

        return ClientDashboardSummaryResponse(
            openMatters=open_matters,
            contractBreakdown=ContractBreakdown(total=len(matters), signed=signed, pending=pending, expired=expired),
            recentActions=recent_actions,
        )
