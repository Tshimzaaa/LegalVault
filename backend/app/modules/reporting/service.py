import csv
import io
from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.modules.matters.repository import MatterRepository
from app.modules.matters.models import MatterStatus, TaskStatus
from app.modules.auth.repository import AuthRepository
from app.modules.clients.repository import ClientRepository
from app.modules.reporting.schemas import (
    ReportingOverviewResponse,
    StatusBreakdownItem,
    StaffWorkloadItem,
)

STATUS_LABELS = {
    MatterStatus.INTAKE: "Intake",
    MatterStatus.IN_REVIEW: "In Review",
    MatterStatus.AWAITING_SIGNATURE: "Awaiting Signature",
    MatterStatus.SIGNED: "Signed",
    MatterStatus.CLOSED: "Closed",
    MatterStatus.DECLINED: "Declined",
}

INACTIVE_STATUSES = {MatterStatus.CLOSED, MatterStatus.DECLINED}


class ReportingService:

    def __init__(self, db: Session):
        self.db = db
        self.matter_repository = MatterRepository(db)
        self.auth_repository = AuthRepository(db)
        self.client_repository = ClientRepository(db)

    def get_overview(self, firm_id) -> ReportingOverviewResponse:
        matters = self.matter_repository.list_by_firm(firm_id)

        status_counts = {status: 0 for status in MatterStatus}
        for matter in matters:
            status_counts[matter.status] += 1

        staff = self.auth_repository.list_by_firm(firm_id)
        assignments = self.matter_repository.list_assignments_for_firm(firm_id)
        tasks = self.matter_repository.list_tasks_for_firm(firm_id)

        total_matter_ids_by_user = defaultdict(set)
        active_matter_ids_by_user = defaultdict(set)
        for assignment, matter in assignments:
            total_matter_ids_by_user[assignment.user_id].add(matter.id)
            if matter.status not in INACTIVE_STATUSES:
                active_matter_ids_by_user[assignment.user_id].add(matter.id)

        today = date.today()
        open_tasks_by_user = defaultdict(int)
        overdue_tasks_by_user = defaultdict(int)
        open_tasks_total = 0
        overdue_tasks_total = 0
        for task, _matter in tasks:
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
                active_matters=len(active_matter_ids_by_user.get(user.id, ())),
                total_matters=len(total_matter_ids_by_user.get(user.id, ())),
                open_tasks=open_tasks_by_user.get(user.id, 0),
                overdue_tasks=overdue_tasks_by_user.get(user.id, 0),
            )
            for user in staff
        ]
        staff_workload.sort(key=lambda item: item.active_matters, reverse=True)

        assigned_matter_ids = {matter_id for ids in total_matter_ids_by_user.values() for matter_id in ids}
        unassigned_active_matters = sum(
            1
            for matter in matters
            if matter.status not in INACTIVE_STATUSES and matter.id not in assigned_matter_ids
        )

        upcoming_cutoff = today + timedelta(days=7)
        upcoming_deadlines = sum(
            1
            for matter in matters
            if matter.status not in INACTIVE_STATUSES
            and matter.due_date is not None
            and today <= matter.due_date <= upcoming_cutoff
        )

        return ReportingOverviewResponse(
            total_matters=len(matters),
            status_breakdown=[
                StatusBreakdownItem(status=status.value, label=STATUS_LABELS[status], count=status_counts[status])
                for status in MatterStatus
            ],
            staff_workload=staff_workload,
            unassigned_active_matters=unassigned_active_matters,
            open_tasks=open_tasks_total,
            overdue_tasks=overdue_tasks_total,
            upcoming_deadlines_7_days=upcoming_deadlines,
        )

    def export_matters_csv(self, firm_id) -> str:
        matters = self.matter_repository.list_by_firm(firm_id)
        assignments = self.matter_repository.list_assignments_for_firm(firm_id)
        tasks = self.matter_repository.list_tasks_for_firm(firm_id)

        assignee_names_by_matter = defaultdict(list)
        for assignment, matter in assignments:
            user = self.auth_repository.get_user_by_id(assignment.user_id)
            if user:
                assignee_names_by_matter[matter.id].append(f"{user.first_name} {user.last_name}")

        open_task_counts_by_matter = defaultdict(int)
        total_task_counts_by_matter = defaultdict(int)
        for task, matter in tasks:
            total_task_counts_by_matter[matter.id] += 1
            if task.status != TaskStatus.DONE:
                open_task_counts_by_matter[matter.id] += 1

        client_names = {}

        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow([
            "Title", "Client", "Status", "Due Date", "Assigned Staff",
            "Open Tasks", "Total Tasks", "Visible to Client", "Created At",
        ])
        for matter in matters:
            if matter.client_id not in client_names:
                client = self.client_repository.get_client_by_id(matter.client_id)
                client_names[matter.client_id] = client.company_name if client else ""

            writer.writerow([
                matter.title,
                client_names[matter.client_id],
                STATUS_LABELS[matter.status],
                matter.due_date.isoformat() if matter.due_date else "",
                "; ".join(assignee_names_by_matter.get(matter.id, [])),
                open_task_counts_by_matter.get(matter.id, 0),
                total_task_counts_by_matter.get(matter.id, 0),
                "Yes" if matter.is_visible_to_client else "No",
                matter.created_at.isoformat(),
            ])

        return buffer.getvalue()
