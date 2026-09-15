import csv
import io
from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.modules.contracts.repository import ContractRepository
from app.modules.contracts.models import ContractStage, TaskStatus
from app.modules.auth.repository import AuthRepository
from app.modules.reporting.schemas import (
    ReportingOverviewResponse,
    StatusBreakdownItem,
    StaffWorkloadItem,
)

STATUS_LABELS = {
    ContractStage.INTAKE: "Intake",
    ContractStage.IN_REVIEW: "In Review",
    ContractStage.AWAITING_SIGNATURE: "Awaiting Signature",
    ContractStage.SIGNED: "Signed",
    ContractStage.CLOSED: "Closed",
    ContractStage.DECLINED: "Declined",
}

INACTIVE_STATUSES = {ContractStage.CLOSED, ContractStage.DECLINED}

# Rough, explicitly-approximate hours-per-open-task used to translate a raw task count into
# a utilization percentage against a staff member's weekly_capacity_hours — contract tasks
# don't carry their own time estimates (see ContractTask), so this is a baseline assumption,
# not measured time. Revisit if/when tasks gain real hour estimates.
ASSUMED_HOURS_PER_OPEN_TASK = 2.0


class ReportingService:

    def __init__(self, db: Session):
        self.db = db
        self.contract_repository = ContractRepository(db)
        self.auth_repository = AuthRepository(db)

    def get_overview(self, org_id) -> ReportingOverviewResponse:
        contracts = self.contract_repository.list_by_org(org_id)

        status_counts = {status: 0 for status in ContractStage}
        for contract in contracts:
            status_counts[contract.status] += 1

        staff = self.auth_repository.list_by_org(org_id)
        assignments = self.contract_repository.list_assignments_for_org(org_id)
        tasks = self.contract_repository.list_tasks_for_org(org_id)

        total_contract_ids_by_user = defaultdict(set)
        active_contract_ids_by_user = defaultdict(set)
        for assignment, contract in assignments:
            total_contract_ids_by_user[assignment.user_id].add(contract.id)
            if contract.status not in INACTIVE_STATUSES:
                active_contract_ids_by_user[assignment.user_id].add(contract.id)

        today = date.today()
        open_tasks_by_user = defaultdict(int)
        overdue_tasks_by_user = defaultdict(int)
        open_tasks_total = 0
        overdue_tasks_total = 0
        for task, _contract in tasks:
            if task.status == TaskStatus.DONE:
                continue
            open_tasks_total += 1
            is_overdue = task.due_date is not None and task.due_date < today
            if is_overdue:
                overdue_tasks_total += 1
            if task.assigned_to is not None:
                open_tasks_by_user[task.assigned_to] += 1
                if is_overdue:
                    overdue_tasks_by_user[task.assigned_to] += 1

        staff_workload = [
            StaffWorkloadItem(
                user_id=user.id,
                name=f"{user.first_name} {user.last_name}",
                active_contracts=len(active_contract_ids_by_user.get(user.id, ())),
                total_contracts=len(total_contract_ids_by_user.get(user.id, ())),
                open_tasks=open_tasks_by_user.get(user.id, 0),
                overdue_tasks=overdue_tasks_by_user.get(user.id, 0),
                weekly_capacity_hours=user.weekly_capacity_hours,
                utilization_percent=(
                    round(
                        open_tasks_by_user.get(user.id, 0) * ASSUMED_HOURS_PER_OPEN_TASK
                        / user.weekly_capacity_hours
                        * 100,
                        1,
                    )
                    if user.weekly_capacity_hours
                    else None
                ),
            )
            for user in staff
        ]
        staff_workload.sort(key=lambda item: item.active_contracts, reverse=True)

        assigned_contract_ids = {contract_id for ids in total_contract_ids_by_user.values() for contract_id in ids}
        unassigned_active_contracts = sum(
            1
            for contract in contracts
            if contract.status not in INACTIVE_STATUSES and contract.id not in assigned_contract_ids
        )

        upcoming_cutoff = today + timedelta(days=7)
        upcoming_deadlines = sum(
            1
            for contract in contracts
            if contract.status not in INACTIVE_STATUSES
            and contract.due_date is not None
            and today <= contract.due_date <= upcoming_cutoff
        )

        return ReportingOverviewResponse(
            total_contracts=len(contracts),
            status_breakdown=[
                StatusBreakdownItem(status=status.value, label=STATUS_LABELS[status], count=status_counts[status])
                for status in ContractStage
            ],
            staff_workload=staff_workload,
            unassigned_active_contracts=unassigned_active_contracts,
            open_tasks=open_tasks_total,
            overdue_tasks=overdue_tasks_total,
            upcoming_deadlines_7_days=upcoming_deadlines,
        )

    def export_contracts_csv(self, org_id) -> str:
        contracts = self.contract_repository.list_by_org(org_id)
        assignments = self.contract_repository.list_assignments_for_org(org_id)
        tasks = self.contract_repository.list_tasks_for_org(org_id)

        users_by_id = {
            user.id: user
            for user in self.auth_repository.list_users_by_ids(
                {assignment.user_id for assignment, _contract in assignments}
            )
        }
        assignee_names_by_contract = defaultdict(list)
        for assignment, contract in assignments:
            user = users_by_id.get(assignment.user_id)
            if user:
                assignee_names_by_contract[contract.id].append(f"{user.first_name} {user.last_name}")

        open_task_counts_by_contract = defaultdict(int)
        total_task_counts_by_contract = defaultdict(int)
        for task, contract in tasks:
            total_task_counts_by_contract[contract.id] += 1
            if task.status != TaskStatus.DONE:
                open_task_counts_by_contract[contract.id] += 1

        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow([
            "Title", "Status", "Due Date", "Assigned Staff",
            "Open Tasks", "Total Tasks", "Created At",
        ])
        for contract in contracts:
            writer.writerow([
                contract.title,
                STATUS_LABELS[contract.status],
                contract.due_date.isoformat() if contract.due_date else "",
                "; ".join(assignee_names_by_contract.get(contract.id, [])),
                open_task_counts_by_contract.get(contract.id, 0),
                total_task_counts_by_contract.get(contract.id, 0),
                contract.created_at.isoformat(),
            ])

        return buffer.getvalue()
