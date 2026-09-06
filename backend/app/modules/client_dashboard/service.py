from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session

from app.modules.matters.repository import MatterRepository
from app.modules.matters.models import MatterStatus
from app.modules.intake.repository import IntakeRepository
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
        self.intake_repository = IntakeRepository(db)

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

        for submission in self.intake_repository.list_recent_by_client(client_id, RECENT_ACTIONS_LIMIT):
            form = self.intake_repository.get_form_by_id(submission.form_id)
            type_label = None
            if form and form.is_system:
                request_type_field = self.intake_repository.get_field_by_key(form.id, "request_type")
                if request_type_field:
                    answer = next((a for a in submission.answers if a.field_id == request_type_field.id), None)
                    if answer and answer.value:
                        type_label = answer.value
            label_text = (
                f"{type_label} request submitted"
                if type_label
                else f'"{form.title}" submitted' if form else "Request submitted"
            )
            events.append((submission.created_at, label_text))

        events.sort(key=lambda e: e[0], reverse=True)
        recent_actions = [
            RecentAction(text=text, occurred_at=occurred_at) for occurred_at, text in events[:RECENT_ACTIONS_LIMIT]
        ]

        return ClientDashboardSummaryResponse(
            openMatters=open_matters,
            contractBreakdown=ContractBreakdown(total=len(matters), signed=signed, pending=pending, expired=expired),
            recentActions=recent_actions,
        )
