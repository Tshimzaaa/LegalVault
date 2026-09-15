import uuid
from datetime import datetime, UTC
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import ObjectDeletedError

from app.modules.contracts.repository import ContractRepository
from app.modules.contracts.models import (
    Contract,
    ContractAssignment,
    ContractApproval,
    ContractDocument,
    ContractTask,
    ContractMessage,
    MessageAuthorType,
    ContractStage,
    ContractRole,
    ApprovalStatus,
)
from app.modules.contracts.schemas import (
    CreateContractRequest,
    UpdateContractDetailsRequest,
    UpdateContractStageRequest,
    UpdateContractDeadlineRequest,
    AssignStaffRequest,
    CreateContractTaskRequest,
    UpdateContractTaskRequest,
    CalendarEvent,
    CreateContractMessageRequest,
    RequestContractApprovalRequest,
    DecideContractApprovalRequest,
)
from app.exceptions.contracts import (
    ContractNotFound,
    StaffAlreadyAssigned,
    ContractDocumentNotFound,
    UserNotFoundForAssignment,
    ContractTaskNotFound,
    ContractMessageNotFound,
    CannotDeleteOthersMessage,
    InvalidStatusTransition,
    ApprovalRequiredForTransition,
    ApprovalAlreadyPending,
    ContractApprovalNotFound,
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
CONTRACT_STATUS_TRANSITIONS: dict[ContractStage, set[ContractStage]] = {
    ContractStage.INTAKE: {ContractStage.IN_REVIEW, ContractStage.DECLINED},
    ContractStage.IN_REVIEW: {ContractStage.AWAITING_SIGNATURE, ContractStage.DECLINED, ContractStage.INTAKE},
    ContractStage.AWAITING_SIGNATURE: {ContractStage.SIGNED, ContractStage.DECLINED, ContractStage.IN_REVIEW},
    ContractStage.SIGNED: {ContractStage.CLOSED},
    ContractStage.CLOSED: set(),
    ContractStage.DECLINED: set(),
}

# Transitions that can't be applied directly via update_status — they must go through
# request_status_approval() + decide_approval() instead.
GATED_TRANSITIONS: set[tuple[ContractStage, ContractStage]] = {
    (ContractStage.AWAITING_SIGNATURE, ContractStage.SIGNED),
    (ContractStage.SIGNED, ContractStage.CLOSED),
}


class ContractService:

    def __init__(self, db: Session):
        self.db = db
        self.repository = ContractRepository(db)
        self.auth_repository = AuthRepository(db)
        self.audit = AuditService(db)
        self.notifications = NotificationService(db)

    def create_contract(self, org_id, actor_id, request: CreateContractRequest) -> Contract:
        contract = Contract(
            org_id=org_id,
            title=request.title,
            description=request.description,
            due_date=request.due_date,
        )
        self.repository.create(contract)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.CONTRACT_CREATED,
            target_type="contract",
            target_id=contract.id,
            details={"title": contract.title},
        )
        self.db.commit()
        return contract

    def _commit_and_refresh(self, contract: Contract) -> Contract:
        # expire_on_commit means the next attribute access re-SELECTs contract;
        # if it was deleted by a concurrent request (e.g. org deletion) in
        # between our read and this commit, that SELECT returns no rows and
        # raises ObjectDeletedError instead of a normal 404.
        self.db.commit()
        try:
            self.db.refresh(contract)
        except ObjectDeletedError:
            raise ContractNotFound()
        return contract

    def get_contract(self, contract_id, org_id) -> Contract:
        contract = self.repository.get_by_id(contract_id)
        if not contract or str(contract.org_id) != str(org_id):
            raise ContractNotFound()
        return contract

    def list_contracts_for_org(self, org_id) -> list[Contract]:
        return self.repository.list_by_org(org_id)

    def update_details(self, contract_id, org_id, actor_id, request: UpdateContractDetailsRequest) -> Contract:
        contract = self.get_contract(contract_id, org_id)
        contract.title = request.title
        contract.description = request.description

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.CONTRACT_DETAILS_UPDATED,
            target_type="contract",
            target_id=contract.id,
            details={"title": request.title},
        )
        return self._commit_and_refresh(contract)

    def update_status(self, contract_id, org_id, actor_id, request: UpdateContractStageRequest) -> Contract:
        contract = self.get_contract(contract_id, org_id)
        previous_status = contract.status
        target = request.status

        if target == previous_status:
            return contract
        if target not in CONTRACT_STATUS_TRANSITIONS.get(previous_status, set()):
            raise InvalidStatusTransition()
        if (previous_status, target) in GATED_TRANSITIONS:
            raise ApprovalRequiredForTransition()

        contract.status = target

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.CONTRACT_STATUS_UPDATED,
            target_type="contract",
            target_id=contract.id,
            details={"from": previous_status.value, "to": request.status.value},
        )
        return self._commit_and_refresh(contract)

    def update_deadline(self, contract_id, org_id, actor_id, request: UpdateContractDeadlineRequest) -> Contract:
        contract = self.get_contract(contract_id, org_id)
        previous_due_date = contract.due_date
        contract.due_date = request.due_date

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.CONTRACT_DEADLINE_UPDATED,
            target_type="contract",
            target_id=contract.id,
            details={
                "from": previous_due_date.isoformat() if previous_due_date else None,
                "to": request.due_date.isoformat() if request.due_date else None,
            },
        )
        return self._commit_and_refresh(contract)

    def assign_staff(self, contract_id, org_id, actor_id, request: AssignStaffRequest) -> ContractAssignment:
        contract = self.get_contract(contract_id, org_id)  # also validates org ownership

        assignee = self.auth_repository.get_user_by_id(request.user_id)
        if not assignee or str(assignee.org_id) != str(org_id):
            raise UserNotFoundForAssignment()

        existing = self.repository.get_assignment(contract_id, request.user_id, request.role_on_contract)
        if existing:
            raise StaffAlreadyAssigned()

        assignment = ContractAssignment(
            contract_id=contract.id,
            user_id=request.user_id,
            role_on_contract=request.role_on_contract,
        )
        self.repository.create_assignment(assignment)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.CONTRACT_STAFF_ASSIGNED,
            target_type="contract_assignment",
            target_id=assignment.id,
            details={"user_id": str(request.user_id), "role_on_contract": request.role_on_contract.value},
        )
        self.notifications.notify(
            recipient_type=RecipientType.STAFF,
            recipient_id=request.user_id,
            type="contract.staff_assigned",
            title=f'You were assigned to "{contract.title}"',
            body=f"Role: {request.role_on_contract.value.replace('_', ' ').title()}",
            target_type="contract",
            target_id=contract.id,
        )
        self.db.commit()
        return assignment

    def list_assignments(self, contract_id, org_id):
        self.get_contract(contract_id, org_id)  # validates ownership, raises 404 if not found/wrong org
        return self.repository.list_assignments_for_contract(contract_id)

    def upload_contract_document(
        self,
        contract_id,
        org_id,
        title: str,
        file_bytes: bytes,
        original_filename: str,
        content_type: str,
        uploaded_by=None,
    ) -> ContractDocument:
        contract = self.get_contract(contract_id, org_id)

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
                target_type="contract_document",
                target_id=None,
                details={"contract_id": str(contract.id), "title": title, "original_filename": original_filename},
            )
            self.db.commit()
            raise

        latest = self.repository.get_latest_version(contract.id, title)
        next_version = (latest.version + 1) if latest else 1

        file_key = f"contract_documents/{contract.id}/{uuid.uuid4()}-{original_filename}"
        upload_file(file_bytes, file_key, content_type)

        document = ContractDocument(
            contract_id=contract.id,
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
            action=audit_actions.CONTRACT_DOCUMENT_UPLOADED,
            target_type="contract_document",
            target_id=document.id,
            details={"title": document.title, "version": document.version},
        )
        self.notifications.notify_many([
            {
                "recipient_type": RecipientType.STAFF,
                "recipient_id": assignment.user_id,
                "type": "contract.document_uploaded",
                "title": f'New document on "{contract.title}"',
                "body": f"{document.title} (v{document.version}) was uploaded.",
                "target_type": "contract",
                "target_id": contract.id,
            }
            for assignment in self.repository.list_assignments_for_contract(contract.id)
            if str(assignment.user_id) != str(uploaded_by)
        ])
        self.db.commit()
        return document

    def list_contract_documents(self, contract_id, org_id) -> list[ContractDocument]:
        self.get_contract(contract_id, org_id)  # ownership check
        return self.repository.list_documents_for_contract(contract_id)

    def get_contract_document_download(self, contract_id, document_id, org_id) -> str:
        self.get_contract(contract_id, org_id)  # ownership check
        document = self.repository.get_document_by_id(document_id)
        if not document or str(document.contract_id) != str(contract_id):
            raise ContractDocumentNotFound()
        return get_download_url(document.file_key)

    def delete_contract_document(self, contract_id, document_id, org_id, actor_id) -> None:
        self.get_contract(contract_id, org_id)  # ownership check
        document = self.repository.get_document_by_id(document_id)
        if not document or str(document.contract_id) != str(contract_id):
            raise ContractDocumentNotFound()

        delete_file(document.file_key)
        self.repository.delete_document(document)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.CONTRACT_DOCUMENT_DELETED,
            target_type="contract_document",
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

    def create_task(self, contract_id, org_id, actor_id, request: CreateContractTaskRequest) -> ContractTask:
        contract = self.get_contract(contract_id, org_id)  # ownership check
        self._validate_assignee(request.assigned_to, org_id)

        task = ContractTask(
            contract_id=contract.id,
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
            action=audit_actions.CONTRACT_TASK_CREATED,
            target_type="contract_task",
            target_id=task.id,
            details={"title": task.title},
        )
        if task.assigned_to is not None:
            self.notifications.notify(
                recipient_type=RecipientType.STAFF,
                recipient_id=task.assigned_to,
                type="contract.task_assigned",
                title=f"New task: {task.title}",
                body=f'Assigned to you on "{contract.title}".',
                target_type="contract",
                target_id=contract.id,
            )
        self.db.commit()
        return task

    def list_tasks(self, contract_id, org_id) -> list[ContractTask]:
        self.get_contract(contract_id, org_id)  # ownership check
        return self.repository.list_tasks_for_contract(contract_id)

    def update_task(self, contract_id, task_id, org_id, actor_id, request: UpdateContractTaskRequest) -> ContractTask:
        contract = self.get_contract(contract_id, org_id)  # ownership check

        task = self.repository.get_task_by_id(task_id)
        if not task or str(task.contract_id) != str(contract_id):
            raise ContractTaskNotFound()

        updates = request.model_dump(exclude_unset=True)
        if "assigned_to" in updates:
            self._validate_assignee(updates["assigned_to"], org_id)

        for field, value in updates.items():
            setattr(task, field, value)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.CONTRACT_TASK_UPDATED,
            target_type="contract_task",
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
                type="contract.task_assigned",
                title=f"Task assigned: {task.title}",
                body=f'You were assigned to a task on "{contract.title}".',
                target_type="contract",
                target_id=contract.id,
            )
        self.db.commit()
        return task

    def _notify_new_message(self, contract, author_type: MessageAuthorType, author_id, author_name, body):
        preview = body if len(body) <= 120 else f"{body[:117]}..."
        title = f'New message on "{contract.title}"'
        notif_body = f"{author_name}: {preview}"

        entries = [
            {
                "recipient_type": RecipientType.STAFF,
                "recipient_id": assignment.user_id,
                "type": "contract.new_message",
                "title": title,
                "body": notif_body,
                "target_type": "contract",
                "target_id": contract.id,
            }
            for assignment in self.repository.list_assignments_for_contract(contract.id)
            if not (author_type == MessageAuthorType.STAFF and str(assignment.user_id) == str(author_id))
        ]

        self.notifications.notify_many(entries)

    def post_message_as_staff(
        self, contract_id, org_id, actor_id, actor_name: str, request: CreateContractMessageRequest
    ) -> ContractMessage:
        contract = self.get_contract(contract_id, org_id)  # ownership check

        message = ContractMessage(
            contract_id=contract.id,
            author_type=MessageAuthorType.STAFF,
            author_id=actor_id,
            author_name=actor_name,
            body=request.body,
        )
        self.repository.create_message(message)
        self._notify_new_message(contract, MessageAuthorType.STAFF, actor_id, actor_name, request.body)
        self.db.commit()
        return message

    def list_messages(self, contract_id, org_id) -> list[ContractMessage]:
        self.get_contract(contract_id, org_id)  # ownership check
        return self.repository.list_messages_for_contract(contract_id)

    def delete_message(self, contract_id, message_id, org_id, actor_id, is_admin: bool):
        self.get_contract(contract_id, org_id)  # ownership check

        message = self.repository.get_message_by_id(message_id)
        if not message or str(message.contract_id) != str(contract_id):
            raise ContractMessageNotFound()

        if not is_admin and str(message.author_id) != str(actor_id):
            raise CannotDeleteOthersMessage()

        self.repository.delete_message(message)
        self.db.commit()

    def delete_task(self, contract_id, task_id, org_id, actor_id):
        self.get_contract(contract_id, org_id)  # ownership check

        task = self.repository.get_task_by_id(task_id)
        if not task or str(task.contract_id) != str(contract_id):
            raise ContractTaskNotFound()

        self.repository.delete_task(task)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.CONTRACT_TASK_DELETED,
            target_type="contract_task",
            target_id=task.id,
            details={"title": task.title},
        )
        self.db.commit()

    def get_calendar(self, org_id, start, end) -> list[CalendarEvent]:
        events = [
            CalendarEvent(
                date=contract.due_date,
                type="contract_deadline",
                title="Contract due date",
                contract_id=contract.id,
                contract_title=contract.title,
            )
            for contract in self.repository.list_contracts_with_deadline_in_range(org_id, start, end)
        ]
        events += [
            CalendarEvent(
                date=task.due_date,
                type="task_due",
                title=task.title,
                contract_id=contract.id,
                contract_title=contract.title,
                task_id=task.id,
            )
            for task, contract in self.repository.list_tasks_with_due_date_in_range(org_id, start, end)
        ]
        events.sort(key=lambda e: e.date)
        return events

    def _eligible_approver_ids(self, org_id, contract_id, exclude_id=None) -> list[uuid.UUID]:
        """Organization admins, plus this contract's lead-lawyer assignees — active users only."""
        org_users = {u.id: u for u in self.auth_repository.list_by_org(org_id)}
        admin_ids = {u.id for u in org_users.values() if u.role == UserRole.ADMIN and u.is_active}
        lead_lawyer_ids = {
            a.user_id
            for a in self.repository.list_assignments_for_contract(contract_id)
            if a.role_on_contract == ContractRole.LEAD_LAWYER and a.user_id in org_users and org_users[a.user_id].is_active
        }
        approver_ids = admin_ids | lead_lawyer_ids
        if exclude_id is not None:
            approver_ids.discard(exclude_id)
        return list(approver_ids)

    def _can_decide_approval(self, actor_id, actor_role, contract_id) -> bool:
        if actor_role == UserRole.ADMIN:
            return True
        return self.repository.get_assignment(contract_id, actor_id, ContractRole.LEAD_LAWYER) is not None

    def request_status_approval(
        self, contract_id, org_id, actor_id, request: RequestContractApprovalRequest
    ) -> ContractApproval:
        contract = self.get_contract(contract_id, org_id)
        current = contract.status
        target = request.to_status

        if (current, target) not in GATED_TRANSITIONS:
            raise InvalidStatusTransition()
        if self.repository.get_pending_approval(contract_id):
            raise ApprovalAlreadyPending()

        approval = ContractApproval(
            contract_id=contract.id,
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
            action=audit_actions.CONTRACT_APPROVAL_REQUESTED,
            target_type="contract_approval",
            target_id=approval.id,
            details={"from": current.value, "to": target.value},
        )
        self.notifications.notify_many([
            {
                "recipient_type": RecipientType.STAFF,
                "recipient_id": approver_id,
                "type": "contract.approval_requested",
                "title": f'Approval needed: "{contract.title}"',
                "body": f"Move from {current.value} to {target.value}?",
                "target_type": "contract",
                "target_id": contract.id,
            }
            for approver_id in self._eligible_approver_ids(org_id, contract_id, exclude_id=actor_id)
        ])
        self.db.commit()
        self.db.refresh(approval)
        return approval

    def list_approvals(self, contract_id, org_id) -> list[ContractApproval]:
        self.get_contract(contract_id, org_id)  # ownership check
        return self.repository.list_approvals_for_contract(contract_id)

    def list_pending_approvals(self, org_id) -> list[ContractApproval]:
        return self.repository.list_pending_approvals_for_org(org_id)

    def decide_approval(
        self, contract_id, approval_id, org_id, actor_id, actor_role, request: DecideContractApprovalRequest
    ) -> ContractApproval:
        contract = self.get_contract(contract_id, org_id)

        approval = self.repository.get_approval_by_id(approval_id)
        if not approval or str(approval.contract_id) != str(contract.id):
            raise ContractApprovalNotFound()
        if approval.status != ApprovalStatus.PENDING:
            raise ApprovalAlreadyDecided()
        if not self._can_decide_approval(actor_id, actor_role, contract_id):
            raise InsufficientPermissions()

        approval.status = ApprovalStatus.APPROVED if request.decision == "approved" else ApprovalStatus.REJECTED
        approval.decided_by = actor_id
        approval.decided_at = datetime.now(UTC)
        approval.decision_note = request.note

        if approval.status == ApprovalStatus.APPROVED:
            contract.status = approval.to_status

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            org_id=org_id,
            action=audit_actions.CONTRACT_APPROVAL_DECIDED,
            target_type="contract_approval",
            target_id=approval.id,
            details={"decision": approval.status.value, "to": approval.to_status.value},
        )
        self.notifications.notify(
            recipient_type=RecipientType.STAFF,
            recipient_id=approval.requested_by,
            type="contract.approval_decided",
            title=f'Approval {approval.status.value}: "{contract.title}"',
            body=(
                f"Your request to move to {approval.to_status.value} was {approval.status.value}."
                + (f" Note: {request.note}" if request.note else "")
            ),
            target_type="contract",
            target_id=contract.id,
        )
        self.db.commit()
        self.db.refresh(approval)
        return approval
