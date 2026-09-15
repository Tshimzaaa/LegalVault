from uuid import UUID

from pydantic import BaseModel


class StatusBreakdownItem(BaseModel):
    status: str
    label: str
    count: int


class StaffWorkloadItem(BaseModel):
    user_id: UUID
    name: str
    active_contracts: int
    total_contracts: int
    open_tasks: int
    overdue_tasks: int


class ReportingOverviewResponse(BaseModel):
    total_contracts: int
    status_breakdown: list[StatusBreakdownItem]
    staff_workload: list[StaffWorkloadItem]
    unassigned_active_contracts: int
    open_tasks: int
    overdue_tasks: int
    upcoming_deadlines_7_days: int
