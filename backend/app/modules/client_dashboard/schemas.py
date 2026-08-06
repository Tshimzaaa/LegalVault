from datetime import datetime

from pydantic import BaseModel


class ContractBreakdown(BaseModel):
    total: int
    signed: int
    pending: int
    expired: int


class RecentAction(BaseModel):
    text: str
    occurred_at: datetime


class ClientDashboardSummaryResponse(BaseModel):
    openMatters: int
    contractBreakdown: ContractBreakdown
    recentActions: list[RecentAction]
