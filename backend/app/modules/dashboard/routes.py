from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.matters.service import MatterService
from app.modules.matters.models import MatterStatus
from app.modules.dashboard.schemas import (
    ActiveCasesSummary,
    ContractStatusBreakdownItem,
    ContractStatusSummary,
    DashboardSummaryResponse,
    FinancialSummary,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


STATUS_META = [
    (MatterStatus.INTAKE, "Intake", "#eab308"),
    (MatterStatus.IN_REVIEW, "In Review", "#3987e5"),
    (MatterStatus.AWAITING_SIGNATURE, "Awaiting Signature", "#a855f7"),
    (MatterStatus.SIGNED, "Signed", "#199e70"),
    (MatterStatus.CLOSED, "Closed", "#22c55e"),
    (MatterStatus.DECLINED, "Declined", "#ef4444"),
]


@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    matters = MatterService(db).list_matters_for_firm(current_user.firm_id)

    total = len(matters)
    counts = {status: sum(1 for m in matters if m.status == status) for status, _, _ in STATUS_META}
    closed = counts[MatterStatus.CLOSED]
    declined = counts[MatterStatus.DECLINED]
    signed = counts[MatterStatus.SIGNED]
    active = total - closed - declined

    def pct(n: int) -> int:
        return round(n / total * 100) if total else 0

    return DashboardSummaryResponse(
        activeCases=ActiveCasesSummary(
            count=active,
            totalValue="—",
            progressPercent=pct(closed + signed),
        ),
        contractStatus=ContractStatusSummary(
            total=total,
            breakdown=[
                ContractStatusBreakdownItem(label=label, count=counts[status], color=color)
                for status, label, color in STATUS_META
            ],
            rings=[pct(closed + signed), pct(active), pct(counts[MatterStatus.INTAKE])],
        ),
        keyDeadlines=[],
        financialSummary=FinancialSummary(billableHours=0, sparkline=[]),
        tasks=[],
        recentDocuments=[],
        recentCommunications=[],
    )
