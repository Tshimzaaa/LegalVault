import uuid
from datetime import datetime, UTC
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import ObjectDeletedError

from app.modules.matters.repository import MatterRepository
from app.modules.matters.models import (
    Matter,
    MatterAssignment,
    MatterApproval,
    MatterDocument,
    MatterTask,
    MatterMessage,
    MessageAuthorType,
    MatterStatus,
    MatterRole,
    ApprovalStatus,
)
from app.modules.matters.schemas import (
    CreateMatterRequest,
    UpdateMatterDetailsRequest,
    UpdateMatterStatusRequest,
    UpdateMatterDeadlineRequest,
    AssignStaffRequest,
    CreateMatterTaskRequest,
    UpdateMatterTaskRequest,
    CalendarEvent,
    CreateMatterMessageRequest,
    RequestMatterApprovalRequest,
    DecideMatterApprovalRequest,
)
from app.exceptions.matters import (
    MatterNotFound,
    StaffAlreadyAssigned,
    MatterDocumentNotFound,
    UserNotFoundForAssignment,
    MatterTaskNotFound,
    MatterMessageNotFound,
    CannotDeleteOthersMessage,
    InvalidStatusTransition,
    ApprovalRequiredForTransition,
    ApprovalAlreadyPending,
    MatterApprovalNotFound,
    ApprovalAlreadyDecided,
)
from app.exceptions.auth import InsufficientPermissions
from app.modules.auth.repository import AuthRepository
from app.modules.auth.models.role import UserRole
from app.exceptions.malware import MalwareDetected
from app.core.storage import upload_file, get_download_url, delete_file
from app.core.malware_scan import scan_file
from app.modules.audit.service import AuditService
from app.modules.audit.models import ActorType
from app.modules.audit import actions as audit_actions
from app.modules.notifications.service import NotificationService
from app.modules.notifications.models import RecipientType


ALLOWED_DOCUMENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
}

# Valid next statuses per current status — replaces the old "any status to any status"
# behavior. CLOSED and DECLINED are terminal (no outgoing transitions).
MATTER_STATUS_TRANSITIONS: dict[MatterStatus, set[MatterStatus]] = {
    MatterStatus.INTAKE: {MatterStatus.IN_REVIEW, MatterStatus.DECLINED},
    MatterStatus.IN_REVIEW: {MatterStatus.AWAITING_SIGNATURE, MatterStatus.DECLINED, MatterStatus.INTAKE},
    MatterStatus.AWAITING_SIGNATURE: {MatterStatus.SIGNED, MatterStatus.DECLINED, MatterStatus.IN_REVIEW},
    MatterStatus.SIGNED: {MatterStatus.CLOSED},
    MatterStatus.CLOSED: set(),
    MatterStatus.DECLINED: set(),
}

# Transitions that can't be applied directly via update_status — they must go through
# request_status_approval() + decide_approval() instead.
GATED_TRANSITIONS: set[tuple[MatterStatus, MatterStatus]] = {
    (MatterStatus.AWAITING_SIGNATURE, MatterStatus.SIGNED),
    (MatterStatus.SIGNED, MatterStatus.CLOSED),
}


class MatterService:

    def __init__(self, db: Session):
        self.db = db
        self.repository = MatterRepository(db)
        self.auth_repository = AuthRepository(db)
        self.audit = AuditService(db)
        self.notifications = NotificationService(db)

    def create_matter(self, org_id, actor_id, request: CreateMatterRequest) -> Matter:
        matter = Matter(
            org_id=org_id,
            title=request.title,
            description=request.description,
            due_date=request.due_date,
        )
        self.repository.create(matter)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.MATTER_CREATED,
            target_type="matter",
            target_id=matter.id,
            details={"title": matter.title},
        )
        self.db.commit()
        return matter

    def _commit_and_refresh(self, matter: Matter) -> Matter:
        # expire_on_commit means the next attribute access re-SELECTs matter;
        # if it was deleted by a concurrent request (e.g. org deletion) in
        # between our read and this commit, that SELECT returns no rows and
        # raises ObjectDeletedError instead of a normal 404.
        self.db.commit()
        try:
            self.db.refresh(matter)
        except ObjectDeletedError:
            raise MatterNotFound()
        return matter

    def get_matter(self, matter_id, org_id) -> Matter:
        matter = self.repository.get_by_id(matter_id)
        if not matter or str(matter.org_id) != str(org_id):
            raise MatterNotFound()
        return matter

    def list_matters_for_org(self, org_id) -> list[Matter]:
        return self.repository.list_by_org(org_id)

    def update_details(self, matter_id, org_id, actor_id, request: UpdateMatterDetailsRequest) -> Matter:
        matter = self.get_matter(matter_id, org_id)
        matter.title = request.title
        matter.description = request.description

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.MATTER_DETAILS_UPDATED,
            target_type="matter",
            target_id=matter.id,
            details={"title": request.title},
        )
        return self._commit_and_refresh(matter)

    def update_status(self, matter_id, org_id, actor_id, request: UpdateMatterStatusRequest) -> Matter:
        matter = self.get_matter(matter_id, org_id)
        previous_status = matter.status
        target = request.status

        if target == previous_status:
            return matter
        if target not in MATTER_STATUS_TRANSITIONS.get(previous_status, set()):
            raise InvalidStatusTransition()
        if (previous_status, target) in GATED_TRANSITIONS:
            raise ApprovalRequiredForTransition()

        matter.status = target

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.MATTER_STATUS_UPDATED,
            target_type="matter",
            target_id=matter.id,
            details={"from": previous_status.value, "to": request.status.value},
        )
        return self._commit_and_refresh(matter)

    def update_deadline(self, matter_id, org_id, actor_id, request: UpdateMatterDeadlineRequest) -> Matter:
        matter = self.get_matter(matter_id, org_id)
        previous_due_date = matter.due_date
        matter.due_date = request.due_date

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.MATTER_DEADLINE_UPDATED,
            target_type="matter",
            target_id=matter.id,
            details={
                "from": previous_due_date.isoformat() if previous_due_date else None,
                "to": request.due_date.isoformat() if request.due_date else None,
            },
        )
        return self._commit_and_refresh(matter)

    def assign_staff(self, matter_id, org_id, actor_id, request: AssignStaffRequest) -> MatterAssignment:
        matter = self.get_matter(matter_id, org_id)  # also validates org ownership

        assignee = self.auth_repository.get_user_by_id(request.user_id)
        if not assignee or str(assignee.org_id) != str(org_id):
            raise UserNotFoundForAssignment()

        existing = self.repository.get_assignment(matter_id, request.user_id, request.role_on_matter)
        if existing:
            raise StaffAlreadyAssigned()

        assignment = MatterAssignment(
            matter_id=matter.id,
            user_id=request.user_id,
            role_on_matter=request.role_on_matter,
        )
        self.repository.create_assignment(assignment)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.MATTER_STAFF_ASSIGNED,
            target_type="matter_assignment",
            target_id=assignment.id,
            details={"user_id": str(request.user_id), "role_on_matter": request.role_on_matter.value},
        )
        self.notifications.notify(
            recipient_type=RecipientType.STAFF,
            recipient_id=request.user_id,
            type="matter.staff_assigned",
            title=f'You were assigned to "{matter.title}"',
            body=f"Role: {request.role_on_matter.value.replace('_', ' ').title()}",
            target_type="matter",
            target_id=matter.id,
        )
        self.db.commit()
        return assignment

    def list_assignments(self, matter_id, org_id):
        self.get_matter(matter_id, org_id)  # validates ownership, raises 404 if not found/wrong org
        return self.repository.list_assignments_for_matter(matter_id)

    def upload_matter_document(
        self,
        matter_id,
        org_id,
        title: str,
        file_bytes: bytes,
        original_filename: str,
        content_type: str,
        uploaded_by=None,
    ) -> MatterDocument:
        matter = self.get_matter(matter_id, org_id)

        if content_type not in ALLOWED_DOCUMENT_TYPES:
            from app.exceptions.templates import UnsupportedFileType
            raise UnsupportedFileType()

        try:
            scan_file(file_bytes)
        except MalwareDetected:
            self.audit.log(
                actor_type=ActorType.STAFF,
                actor_id=uploaded_by,
                org_id=org_id,
                action=audit_actions.FILE_UPLOAD_BLOCKED_MALWARE,
                target_type="matter_document",
                target_id=None,
                details={"matter_id": str(matter.id), "title": title, "original_filename": original_filename},
            )
            self.db.commit()
            raise

        latest = self.repository.get_latest_version(matter.id, title)
        next_version = (latest.version + 1) if latest else 1

        file_key = f"matter_documents/{matter.id}/{uuid.uuid4()}-{original_filename}"
        upload_file(file_bytes, file_key, content_type)

        document = MatterDocument(
            matter_id=matter.id,
            uploaded_by=uploaded_by,
            title=title,
            version=next_version,
            file_key=file_key,
            original_filename=original_filename,
            content_type=content_type,
        )
        self.repository.create_document(document)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=uploaded_by,
            org_id=org_id,
            action=audit_actions.MATTER_DOCUMENT_UPLOADED,
            target_type="matter_document",
            target_id=document.id,
            details={"title": document.title, "version": document.version},
        )
        self.notifications.notify_many([
            {
                "recipient_type": RecipientType.STAFF,
                "recipient_id": assignment.user_id,
                "type": "matter.document_uploaded",
                "title": f'New document on "{matter.title}"',
                "body": f"{document.title} (v{document.version}) was uploaded.",
                "target_type": "matter",
                "target_id": matter.id,
            }
            for assignment in self.repository.list_assignments_for_matter(matter.id)
            if str(assignment.user_id) != str(uploaded_by)
        ])
        self.db.commit()
        return document

    def list_matter_documents(self, matter_id, org_id) -> list[MatterDocument]:
        self.get_matter(matter_id, org_id)  # ownership check
        return self.repository.list_documents_for_matter(matter_id)

    def get_matter_document_download(self, matter_id, document_id, org_id) -> str:
        self.get_matter(matter_id, org_id)  # ownership check
        document = self.repository.get_document_by_id(document_id)
        if not document or str(document.matter_id) != str(matter_id):
            raise MatterDocumentNotFound()
        return get_download_url(document.file_key)

    def delete_matter_document(self, matter_id, document_id, org_id, actor_id) -> None:
        self.get_matter(matter_id, org_id)  # ownership check
        document = self.repository.get_document_by_id(document_id)
        if not document or str(document.matter_id) != str(matter_id):
            raise MatterDocumentNotFound()

        delete_file(document.file_key)
        self.repository.delete_document(document)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.MATTER_DOCUMENT_DELETED,
            target_type="matter_document",
            target_id=document.id,
            details={"title": document.title, "version": document.version},
        )
        self.db.commit()

    def _validate_assignee(self, assigned_to, org_id):
        if assigned_to is None:
            return
        assignee = self.auth_repository.get_user_by_id(assigned_to)
        if not assignee or str(assignee.org_id) != str(org_id):
            raise UserNotFoundForAssignment()

    def create_task(self, matter_id, org_id, actor_id, request: CreateMatterTaskRequest) -> MatterTask:
        matter = self.get_matter(matter_id, org_id)  # ownership check
        self._validate_assignee(request.assigned_to, org_id)

        task = MatterTask(
            matter_id=matter.id,
            title=request.title,
            description=request.description,
            assigned_to=request.assigned_to,
            due_date=request.due_date,
        )
        self.repository.create_task(task)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.MATTER_TASK_CREATED,
            target_type="matter_task",
            target_id=task.id,
            details={"title": task.title},
        )
        if task.assigned_to is not None:
            self.notifications.notify(
                recipient_type=RecipientType.STAFF,
                recipient_id=task.assigned_to,
                type="matter.task_assigned",
                title=f"New task: {task.title}",
                body=f'Assigned to you on "{matter.title}".',
                target_type="matter",
                target_id=matter.id,
            )
        self.db.commit()
        return task

    def list_tasks(self, matter_id, org_id) -> list[MatterTask]:
        self.get_matter(matter_id, org_id)  # ownership check
        return self.repository.list_tasks_for_matter(matter_id)

    def update_task(self, matter_id, task_id, org_id, actor_id, request: UpdateMatterTaskRequest) -> MatterTask:
        matter = self.get_matter(matter_id, org_id)  # ownership check

        task = self.repository.get_task_by_id(task_id)
        if not task or str(task.matter_id) != str(matter_id):
            raise MatterTaskNotFound()

        updates = request.model_dump(exclude_unset=True)
        if "assigned_to" in updates:
            self._validate_assignee(updates["assigned_to"], org_id)

        for field, value in updates.items():
            setattr(task, field, value)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.MATTER_TASK_UPDATED,
            target_type="matter_task",
            target_id=task.id,
            details={
                k: (v.value if hasattr(v, "value") else (str(v) if v is not None else None))
                for k, v in updates.items()
            },
        )
        if "assigned_to" in updates and updates["assigned_to"] is not None:
            self.notifications.notify(
                recipient_type=RecipientType.STAFF,
                recipient_id=updates["assigned_to"],
                type="matter.task_assigned",
                title=f"Task assigned: {task.title}",
                body=f'You were assigned to a task on "{matter.title}".',
                target_type="matter",
                target_id=matter.id,
            )
        self.db.commit()
        return task

    def _notify_new_message(self, matter, author_type: MessageAuthorType, author_id, author_name, body):
        preview = body if len(body) <= 120 else f"{body[:117]}..."
        title = f'New message on "{matter.title}"'
        notif_body = f"{author_name}: {preview}"

        entries = [
            {
                "recipient_type": RecipientType.STAFF,
                "recipient_id": assignment.user_id,
                "type": "matter.new_message",
                "title": title,
                "body": notif_body,
                "target_type": "matter",
                "target_id": matter.id,
            }
            for assignment in self.repository.list_assignments_for_matter(matter.id)
            if not (author_type == MessageAuthorType.STAFF and str(assignment.user_id) == str(author_id))
        ]

        self.notifications.notify_many(entries)

    def post_message_as_staff(
        self, matter_id, org_id, actor_id, actor_name: str, request: CreateMatterMessageRequest
    ) -> MatterMessage:
        matter = self.get_matter(matter_id, org_id)  # ownership check

        message = MatterMessage(
            matter_id=matter.id,
            author_type=MessageAuthorType.STAFF,
            author_id=actor_id,
            author_name=actor_name,
            body=request.body,
        )
        self.repository.create_message(message)
        self._notify_new_message(matter, MessageAuthorType.STAFF, actor_id, actor_name, request.body)
        self.db.commit()
        return message

    def list_messages(self, matter_id, org_id) -> list[MatterMessage]:
        self.get_matter(matter_id, org_id)  # ownership check
        return self.repository.list_messages_for_matter(matter_id)

    def delete_message(self, matter_id, message_id, org_id, actor_id, is_admin: bool):
        self.get_matter(matter_id, org_id)  # ownership check

        message = self.repository.get_message_by_id(message_id)
        if not message or str(message.matter_id) != str(matter_id):
            raise MatterMessageNotFound()

        if not is_admin and str(message.author_id) != str(actor_id):
            raise CannotDeleteOthersMessage()

        self.repository.delete_message(message)
        self.db.commit()

    def delete_task(self, matter_id, task_id, org_id, actor_id):
        self.get_matter(matter_id, org_id)  # ownership check

        task = self.repository.get_task_by_id(task_id)
        if not task or str(task.matter_id) != str(matter_id):
            raise MatterTaskNotFound()

        self.repository.delete_task(task)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.MATTER_TASK_DELETED,
            target_type="matter_task",
            target_id=task.id,
            details={"title": task.title},
        )
        self.db.commit()

    def get_calendar(self, org_id, start, end) -> list[CalendarEvent]:
        events = [
            CalendarEvent(
                date=matter.due_date,
                type="matter_deadline",
                title="Matter due date",
                matter_id=matter.id,
                matter_title=matter.title,
            )
            for matter in self.repository.list_matters_with_deadline_in_range(org_id, start, end)
        ]
        events += [
            CalendarEvent(
                date=task.due_date,
                type="task_due",
                title=task.title,
                matter_id=matter.id,
                matter_title=matter.title,
                task_id=task.id,
            )
            for task, matter in self.repository.list_tasks_with_due_date_in_range(org_id, start, end)
        ]
        events.sort(key=lambda e: e.date)
        return events

    def _eligible_approver_ids(self, org_id, matter_id, exclude_id=None) -> list[uuid.UUID]:
        """Organization admins, plus this matter's lead-lawyer assignees — active users only."""
        org_users = {u.id: u for u in self.auth_repository.list_by_org(org_id)}
        admin_ids = {u.id for u in org_users.values() if u.role == UserRole.ADMIN and u.is_active}
        lead_lawyer_ids = {
            a.user_id
            for a in self.repository.list_assignments_for_matter(matter_id)
            if a.role_on_matter == MatterRole.LEAD_LAWYER and a.user_id in org_users and org_users[a.user_id].is_active
        }
        approver_ids = admin_ids | lead_lawyer_ids
        if exclude_id is not None:
            approver_ids.discard(exclude_id)
        return list(approver_ids)

    def _can_decide_approval(self, actor_id, actor_role, matter_id) -> bool:
        if actor_role == UserRole.ADMIN:
            return True
        return self.repository.get_assignment(matter_id, actor_id, MatterRole.LEAD_LAWYER) is not None

    def request_status_approval(
        self, matter_id, org_id, actor_id, request: RequestMatterApprovalRequest
    ) -> MatterApproval:
        matter = self.get_matter(matter_id, org_id)
        current = matter.status
        target = request.to_status

        if (current, target) not in GATED_TRANSITIONS:
            raise InvalidStatusTransition()
        if self.repository.get_pending_approval(matter_id):
            raise ApprovalAlreadyPending()

        approval = MatterApproval(
            matter_id=matter.id,
            requested_by=actor_id,
            from_status=current,
            to_status=target,
            status=ApprovalStatus.PENDING,
        )
        self.repository.create_approval(approval)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.MATTER_APPROVAL_REQUESTED,
            target_type="matter_approval",
            target_id=approval.id,
            details={"from": current.value, "to": target.value},
        )
        self.notifications.notify_many([
            {
                "recipient_type": RecipientType.STAFF,
                "recipient_id": approver_id,
                "type": "matter.approval_requested",
                "title": f'Approval needed: "{matter.title}"',
                "body": f"Move from {current.value} to {target.value}?",
                "target_type": "matter",
                "target_id": matter.id,
            }
            for approver_id in self._eligible_approver_ids(org_id, matter_id, exclude_id=actor_id)
        ])
        self.db.commit()
        self.db.refresh(approval)
        return approval

    def list_approvals(self, matter_id, org_id) -> list[MatterApproval]:
        self.get_matter(matter_id, org_id)  # ownership check
        return self.repository.list_approvals_for_matter(matter_id)

    def list_pending_approvals(self, org_id) -> list[MatterApproval]:
        return self.repository.list_pending_approvals_for_org(org_id)

    def decide_approval(
        self, matter_id, approval_id, org_id, actor_id, actor_role, request: DecideMatterApprovalRequest
    ) -> MatterApproval:
        matter = self.get_matter(matter_id, org_id)

        approval = self.repository.get_approval_by_id(approval_id)
        if not approval or str(approval.matter_id) != str(matter.id):
            raise MatterApprovalNotFound()
        if approval.status != ApprovalStatus.PENDING:
            raise ApprovalAlreadyDecided()
        if not self._can_decide_approval(actor_id, actor_role, matter_id):
            raise InsufficientPermissions()

        approval.status = ApprovalStatus.APPROVED if request.decision == "approved" else ApprovalStatus.REJECTED
        approval.decided_by = actor_id
        approval.decided_at = datetime.now(UTC)
        approval.decision_note = request.note

        if approval.status == ApprovalStatus.APPROVED:
            matter.status = approval.to_status

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.MATTER_APPROVAL_DECIDED,
            target_type="matter_approval",
            target_id=approval.id,
            details={"decision": approval.status.value, "to": approval.to_status.value},
        )
        self.notifications.notify(
            recipient_type=RecipientType.STAFF,
            recipient_id=approval.requested_by,
            type="matter.approval_decided",
            title=f'Approval {approval.status.value}: "{matter.title}"',
            body=(
                f"Your request to move to {approval.to_status.value} was {approval.status.value}."
                + (f" Note: {request.note}" if request.note else "")
            ),
            target_type="matter",
            target_id=matter.id,
        )
        self.db.commit()
        self.db.refresh(approval)
        return approval
