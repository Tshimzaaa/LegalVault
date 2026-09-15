from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.contracts.service import ContractService
from app.modules.contracts.repository import ContractRepository
from app.modules.contracts.models import ContractStage, TaskStatus
from app.modules.dashboard.schemas import (
    ActiveCasesSummary,
    ContractStatusBreakdownItem,
    ContractStatusSummary,
    DashboardSummaryResponse,
    KeyDeadline,
    TaskItem,
    RecentDocument,
    RecentCommunication,
)

ACTIVE_LIMIT = 5
INACTIVE_STATUSES = {ContractStage.CLOSED, ContractStage.DECLINED}


def _deadline_flag_color(due_date: date, today: date) -> str:
    days_out = (due_date - today).days
    if days_out <= 2:
        return "#ef4444"
    if days_out <= 7:
        return "#eab308"
    return "#3987e5"


def _preview(text: str, max_length: int = 80) -> str:
    return text if len(text) <= max_length else f"{text[:max_length - 3]}..."

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


STATUS_META = [
    (ContractStage.INTAKE, "Intake", "#eab308"),
    (ContractStage.IN_REVIEW, "In Review", "#3987e5"),
    (ContractStage.AWAITING_SIGNATURE, "Awaiting Signature", "#a855f7"),
    (ContractStage.SIGNED, "Signed", "#199e70"),
    (ContractStage.CLOSED, "Closed", "#22c55e"),
    (ContractStage.DECLINED, "Declined", "#ef4444"),
]


@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    org_id = current_user.org_id
    contract_repository = ContractRepository(db)
    contracts = ContractService(db).list_contracts_for_org(org_id)

    total = len(contracts)
    counts = {status: sum(1 for m in contracts if m.status == status) for status, _, _ in STATUS_META}
    closed = counts[ContractStage.CLOSED]
    declined = counts[ContractStage.DECLINED]
    signed = counts[ContractStage.SIGNED]
    active = total - closed - declined

    def pct(n: int) -> int:
        return round(n / total * 100) if total else 0

    today = date.today()

    upcoming_contracts = sorted(
        (m for m in contracts if m.due_date is not None and m.status not in INACTIVE_STATUSES),
        key=lambda m: m.due_date,
    )[:ACTIVE_LIMIT]
    key_deadlines = [
        KeyDeadline(
            title=m.title,
            deadline=m.due_date.isoformat(),
            flagColor=_deadline_flag_color(m.due_date, today),
        )
        for m in upcoming_contracts
    ]

    open_tasks = sorted(
        (
            (task, contract)
            for task, contract in contract_repository.list_tasks_for_org(org_id)
            if task.status != TaskStatus.DONE and task.due_date is not None
        ),
        key=lambda pair: pair[0].due_date,
    )[:ACTIVE_LIMIT]
    tasks = [
        TaskItem(title=f"{task.title} ({contract.title})", deadline=task.due_date.isoformat())
        for task, contract in open_tasks
    ]

    recent_documents = [
        RecentDocument(title=document.title, subtitle=f"{contract.title} · v{document.version}")
        for document, contract in contract_repository.list_recent_documents_for_org(org_id, limit=ACTIVE_LIMIT)
    ]

    recent_communications = [
        RecentCommunication(text=f'{message.author_name} on "{contract.title}": {_preview(message.body)}')
        for message, contract in contract_repository.list_recent_messages_for_org(org_id, limit=ACTIVE_LIMIT)
    ]

    return DashboardSummaryResponse(
        activeCases=ActiveCasesSummary(
            count=active,
            progressPercent=pct(closed + signed),
        ),
        contractStatus=ContractStatusSummary(
            total=total,
            breakdown=[
                ContractStatusBreakdownItem(label=label, count=counts[status], color=color)
                for status, label, color in STATUS_META
            ],
        ),
        keyDeadlines=key_deadlines,
        tasks=tasks,
        recentDocuments=recent_documents,
        recentCommunications=recent_communications,
    )
