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
    weekly_capacity_hours: float | None
    # Approximation, not hour-accurate: tasks don't carry time estimates, so this
    # expresses open tasks against a firm-wide baseline (see ASSUMED_HOURS_PER_OPEN_TASK
    # in service.py) scaled by the staff member's own capacity. Null when capacity isn't set.
    utilization_percent: float | None


class ReportingOverviewResponse(BaseModel):
    total_contracts: int
    status_breakdown: list[StatusBreakdownItem]
    staff_workload: list[StaffWorkloadItem]
    unassigned_active_contracts: int
    open_tasks: int
    overdue_tasks: int
    upcoming_deadlines_7_days: int
