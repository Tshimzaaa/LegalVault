from pydantic import BaseModel


class ActiveCasesSummary(BaseModel):
    count: int
    progressPercent: int


class ContractStatusBreakdownItem(BaseModel):
    label: str
    count: int
    color: str


class ContractStatusSummary(BaseModel):
    total: int
    breakdown: list[ContractStatusBreakdownItem]


class KeyDeadline(BaseModel):
    title: str
    deadline: str
    flagColor: str


class TaskItem(BaseModel):
    title: str
    deadline: str


class RecentDocument(BaseModel):
    title: str
    subtitle: str


class RecentCommunication(BaseModel):
    text: str


class DashboardSummaryResponse(BaseModel):
    activeCases: ActiveCasesSummary
    contractStatus: ContractStatusSummary
    keyDeadlines: list[KeyDeadline]
    tasks: list[TaskItem]
    recentDocuments: list[RecentDocument]
    recentCommunications: list[RecentCommunication]
