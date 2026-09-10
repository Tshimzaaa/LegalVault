import uuid
from datetime import date, datetime, UTC
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
    MatterContactPermission,
    MatterStatus,
    MatterRole,
    ApprovalStatus,
)
from app.modules.matters.schemas import (
    CreateMatterRequest,
    UpdateMatterDetailsRequest,
    UpdateMatterStatusRequest,
    UpdateMatterVisibilityRequest,
    UpdateMatterDeadlineRequest,
    AssignStaffRequest,
    CreateMatterTaskRequest,
    UpdateMatterTaskRequest,
    CalendarEvent,
    CreateMatterMessageRequest,
    SetContactPermissionRequest,
    MatterContactPermissionResponse,
    RequestMatterApprovalRequest,
    DecideMatterApprovalRequest,
    GenerateDocumentRequest,
)
from app.exceptions.matters import (
    MatterNotFound,
    ClientNotFoundForMatter,
    StaffAlreadyAssigned,
    MatterDocumentNotFound,
    UserNotFoundForAssignment,
    MatterTaskNotFound,
    MatterMessageNotFound,
    CannotDeleteOthersMessage,
    MatterContactPermissionNotFound,
    ContactNotFoundForMatterPermission,
    InvalidStatusTransition,
    ApprovalRequiredForTransition,
    ApprovalAlreadyPending,
    MatterApprovalNotFound,
    ApprovalAlreadyDecided,
    IntakeSubmissionClientMismatch,
)
from app.exceptions.auth import InsufficientPermissions
from app.modules.clients.repository import ClientRepository
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
        self.client_repository = ClientRepository(db)
        self.auth_repository = AuthRepository(db)
        self.audit = AuditService(db)
        self.notifications = NotificationService(db)

    def create_matter(self, firm_id, actor_id, request: CreateMatterRequest) -> Matter:
        client = self.client_repository.get_client_by_id(request.client_id)
        if not client or str(client.firm_id) != str(firm_id):
            raise ClientNotFoundForMatter()

        matter = Matter(
            firm_id=firm_id,
            client_id=request.client_id,
            title=request.title,
            description=request.description,
            due_date=request.due_date,
        )
        self.repository.create(matter)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            firm_id=firm_id,
            action=audit_actions.MATTER_CREATED,
            target_type="matter",
            target_id=matter.id,
            details={"title": matter.title},
        )
        self.db.commit()
        return matter

    def _commit_and_refresh(self, matter: Matter) -> Matter:
        # expire_on_commit means the next attribute access re-SELECTs matter;
        # if it was deleted by a concurrent request (e.g. firm deletion) in
        # between our read and this commit, that SELECT returns no rows and
        # raises ObjectDeletedError instead of a normal 404.
        self.db.commit()
        try:
            self.db.refresh(matter)
        except ObjectDeletedError:
            raise MatterNotFound()
        return matter

    def get_matter(self, matter_id, firm_id) -> Matter:
        matter = self.repository.get_by_id(matter_id)
        if not matter or str(matter.firm_id) != str(firm_id):
            raise MatterNotFound()
        return matter

    def list_matters_for_firm(self, firm_id) -> list[Matter]:
        return self.repository.list_by_firm(firm_id)

    def update_details(self, matter_id, firm_id, actor_id, request: UpdateMatterDetailsRequest) -> Matter:
        matter = self.get_matter(matter_id, firm_id)
        matter.title = request.title
        matter.description = request.description

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            firm_id=firm_id,
            action=audit_actions.MATTER_DETAILS_UPDATED,
            target_type="matter",
            target_id=matter.id,
            details={"title": request.title},
        )
        return self._commit_and_refresh(matter)

    def update_status(self, matter_id, firm_id, actor_id, request: UpdateMatterStatusRequest) -> Matter:
        matter = self.get_matter(matter_id, firm_id)
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
            firm_id=firm_id,
            action=audit_actions.MATTER_STATUS_UPDATED,
            target_type="matter",
            target_id=matter.id,
            details={"from": previous_status.value, "to": request.status.value},
        )
        return self._commit_and_refresh(matter)

    def update_visibility(self, matter_id, firm_id, actor_id, request: UpdateMatterVisibilityRequest) -> Matter:
        matter = self.get_matter(matter_id, firm_id)
        matter.is_visible_to_client = request.is_visible_to_client

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            firm_id=firm_id,
            action=audit_actions.MATTER_VISIBILITY_UPDATED,
            target_type="matter",
            target_id=matter.id,
            details={"is_visible_to_client": request.is_visible_to_client},
        )
        return self._commit_and_refresh(matter)

    def update_deadline(self, matter_id, firm_id, actor_id, request: UpdateMatterDeadlineRequest) -> Matter:
        matter = self.get_matter(matter_id, firm_id)
        previous_due_date = matter.due_date
        matter.due_date = request.due_date

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            firm_id=firm_id,
            action=audit_actions.MATTER_DEADLINE_UPDATED,
            target_type="matter",
            target_id=matter.id,
            details={
                "from": previous_due_date.isoformat() if previous_due_date else None,
                "to": request.due_date.isoformat() if request.due_date else None,
            },
        )
        return self._commit_and_refresh(matter)

    def assign_staff(self, matter_id, firm_id, actor_id, request: AssignStaffRequest) -> MatterAssignment:
        matter = self.get_matter(matter_id, firm_id)  # also validates firm ownership

        assignee = self.auth_repository.get_user_by_id(request.user_id)
        if not assignee or str(assignee.firm_id) != str(firm_id):
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
            firm_id=firm_id,
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

    def list_visible_matters_for_client(self, client_id) -> list[Matter]:
        matters = self.repository.list_by_client(client_id)
        return [m for m in matters if m.is_visible_to_client]

    def list_assignments(self, matter_id, firm_id):
        self.get_matter(matter_id, firm_id)  # validates ownership, raises 404 if not found/wrong firm
        return self.repository.list_assignments_for_matter(matter_id)

    def upload_matter_document(
        self,
        matter_id,
        title: str,
        file_bytes: bytes,
        original_filename: str,
        content_type: str,
        firm_id=None,
        uploaded_by=None,
        client_id=None,
        uploaded_by_contact_id=None,
    ) -> MatterDocument:
        if firm_id is not None:
            matter = self.get_matter(matter_id, firm_id)
        elif client_id is not None:
            matter = self.repository.get_by_id(matter_id)
            if not matter or str(matter.client_id) != str(client_id) or not matter.is_visible_to_client:
                raise MatterNotFound()
        else:
            raise ValueError("Either firm_id or client_id must be provided")

        if content_type not in ALLOWED_DOCUMENT_TYPES:
            from app.exceptions.templates import UnsupportedFileType
            raise UnsupportedFileType()

        try:
            scan_file(file_bytes)
        except MalwareDetected:
            if firm_id is not None:
                self.audit.log(
                    actor_type=ActorType.STAFF,
                    actor_id=uploaded_by,
                    firm_id=firm_id,
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
            uploaded_by_contact_id=uploaded_by_contact_id,
            title=title,
            version=next_version,
            file_key=file_key,
            original_filename=original_filename,
            content_type=content_type,
        )
        self.repository.create_document(document)

        if firm_id is not None:
            self.audit.log(
                actor_type=ActorType.STAFF,
                actor_id=uploaded_by,
                firm_id=firm_id,
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
        else:
            self.notifications.notify_many([
                {
                    "recipient_type": RecipientType.STAFF,
                    "recipient_id": assignment.user_id,
                    "type": "matter.document_uploaded",
                    "title": f'New document on "{matter.title}"',
                    "body": f"{document.title} (v{document.version}) was uploaded by the client.",
                    "target_type": "matter",
                    "target_id": matter.id,
                }
                for assignment in self.repository.list_assignments_for_matter(matter.id)
            ])
        self.db.commit()
        return document

    def list_matter_documents(self, matter_id, firm_id) -> list[MatterDocument]:
        self.get_matter(matter_id, firm_id)  # ownership check
        return self.repository.list_documents_for_matter(matter_id)

    def get_matter_document_download(self, matter_id, document_id, firm_id) -> str:
        self.get_matter(matter_id, firm_id)  # ownership check
        document = self.repository.get_document_by_id(document_id)
        if not document or str(document.matter_id) != str(matter_id):
            raise MatterDocumentNotFound()
        return get_download_url(document.file_key)

    def delete_matter_document(self, matter_id, document_id, firm_id, actor_id) -> None:
        self.get_matter(matter_id, firm_id)  # ownership check
        document = self.repository.get_document_by_id(document_id)
        if not document or str(document.matter_id) != str(matter_id):
            raise MatterDocumentNotFound()

        delete_file(document.file_key)
        self.repository.delete_document(document)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            firm_id=firm_id,
            action=audit_actions.MATTER_DOCUMENT_DELETED,
            target_type="matter_document",
            target_id=document.id,
            details={"title": document.title, "version": document.version},
        )
        self.db.commit()

    def list_client_matter_documents(self, matter_id, client_id) -> list[MatterDocument]:
        matter = self.repository.get_by_id(matter_id)
        if not matter or str(matter.client_id) != str(client_id) or not matter.is_visible_to_client:
            raise MatterNotFound()
        return self.repository.list_documents_for_matter(matter_id)

    def get_client_matter_document_download(self, matter_id, document_id, client_id) -> str:
        matter = self.repository.get_by_id(matter_id)
        if not matter or str(matter.client_id) != str(client_id) or not matter.is_visible_to_client:
            raise MatterNotFound()

        document = self.repository.get_document_by_id(document_id)
        if not document or str(document.matter_id) != str(matter_id):
            raise MatterDocumentNotFound()
        return get_download_url(document.file_key)

    def _validate_assignee(self, assigned_to, firm_id):
        if assigned_to is None:
            return
        assignee = self.auth_repository.get_user_by_id(assigned_to)
        if not assignee or str(assignee.firm_id) != str(firm_id):
            raise UserNotFoundForAssignment()

    def create_task(self, matter_id, firm_id, actor_id, request: CreateMatterTaskRequest) -> MatterTask:
        matter = self.get_matter(matter_id, firm_id)  # ownership check
        self._validate_assignee(request.assigned_to, firm_id)

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
            firm_id=firm_id,
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

    def list_tasks(self, matter_id, firm_id) -> list[MatterTask]:
        self.get_matter(matter_id, firm_id)  # ownership check
        return self.repository.list_tasks_for_matter(matter_id)

    def update_task(self, matter_id, task_id, firm_id, actor_id, request: UpdateMatterTaskRequest) -> MatterTask:
        matter = self.get_matter(matter_id, firm_id)  # ownership check

        task = self.repository.get_task_by_id(task_id)
        if not task or str(task.matter_id) != str(matter_id):
            raise MatterTaskNotFound()

        updates = request.model_dump(exclude_unset=True)
        if "assigned_to" in updates:
            self._validate_assignee(updates["assigned_to"], firm_id)

        for field, value in updates.items():
            setattr(task, field, value)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            firm_id=firm_id,
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

        if author_type == MessageAuthorType.STAFF and matter.is_visible_to_client:
            entries += [
                {
                    "recipient_type": RecipientType.CLIENT_CONTACT,
                    "recipient_id": contact.id,
                    "type": "matter.new_message",
                    "title": title,
                    "body": notif_body,
                    "target_type": "matter",
                    "target_id": matter.id,
                }
                for contact in self.client_repository.list_contacts_for_client(matter.client_id)
            ]

        self.notifications.notify_many(entries)

    def post_message_as_staff(
        self, matter_id, firm_id, actor_id, actor_name: str, request: CreateMatterMessageRequest
    ) -> MatterMessage:
        matter = self.get_matter(matter_id, firm_id)  # ownership check

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

    def list_messages(self, matter_id, firm_id) -> list[MatterMessage]:
        self.get_matter(matter_id, firm_id)  # ownership check
        return self.repository.list_messages_for_matter(matter_id)

    def delete_message(self, matter_id, message_id, firm_id, actor_id, is_admin: bool):
        self.get_matter(matter_id, firm_id)  # ownership check

        message = self.repository.get_message_by_id(message_id)
        if not message or str(message.matter_id) != str(matter_id):
            raise MatterMessageNotFound()

        if not is_admin and str(message.author_id) != str(actor_id):
            raise CannotDeleteOthersMessage()

        self.repository.delete_message(message)
        self.db.commit()

    def _get_visible_matter_for_client(self, matter_id, client_id) -> Matter:
        matter = self.repository.get_by_id(matter_id)
        if not matter or str(matter.client_id) != str(client_id) or not matter.is_visible_to_client:
            raise MatterNotFound()
        return matter

    def post_message_as_client(
        self, matter_id, client_id, actor_id, actor_name: str, request: CreateMatterMessageRequest
    ) -> MatterMessage:
        matter = self._get_visible_matter_for_client(matter_id, client_id)

        message = MatterMessage(
            matter_id=matter.id,
            author_type=MessageAuthorType.CLIENT_CONTACT,
            author_id=actor_id,
            author_name=actor_name,
            body=request.body,
        )
        self.repository.create_message(message)
        self._notify_new_message(matter, MessageAuthorType.CLIENT_CONTACT, actor_id, actor_name, request.body)
        self.db.commit()
        return message

    def list_client_messages(self, matter_id, client_id) -> list[MatterMessage]:
        self._get_visible_matter_for_client(matter_id, client_id)
        return self.repository.list_messages_for_matter(matter_id)

    def delete_client_message(self, matter_id, message_id, client_id, actor_id):
        self._get_visible_matter_for_client(matter_id, client_id)

        message = self.repository.get_message_by_id(message_id)
        if not message or str(message.matter_id) != str(matter_id):
            raise MatterMessageNotFound()

        if str(message.author_id) != str(actor_id):
            raise CannotDeleteOthersMessage()

        self.repository.delete_message(message)
        self.db.commit()

    def delete_task(self, matter_id, task_id, firm_id, actor_id):
        self.get_matter(matter_id, firm_id)  # ownership check

        task = self.repository.get_task_by_id(task_id)
        if not task or str(task.matter_id) != str(matter_id):
            raise MatterTaskNotFound()

        self.repository.delete_task(task)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            firm_id=firm_id,
            action=audit_actions.MATTER_TASK_DELETED,
            target_type="matter_task",
            target_id=task.id,
            details={"title": task.title},
        )
        self.db.commit()

    def get_calendar(self, firm_id, start, end) -> list[CalendarEvent]:
        events = [
            CalendarEvent(
                date=matter.due_date,
                type="matter_deadline",
                title=matter.title,
                matter_id=matter.id,
                matter_title=matter.title,
            )
            for matter in self.repository.list_matters_with_deadline_in_range(firm_id, start, end)
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
            for task, matter in self.repository.list_tasks_with_due_date_in_range(firm_id, start, end)
        ]
        events.sort(key=lambda e: e.date)
        return events

    def get_client_calendar(self, client_id, start, end) -> list[CalendarEvent]:
        events = [
            CalendarEvent(
                date=matter.due_date,
                type="matter_deadline",
                title=matter.title,
                matter_id=matter.id,
                matter_title=matter.title,
            )
            for matter in self.repository.list_visible_matters_with_deadline_in_range(client_id, start, end)
        ]
        events.sort(key=lambda e: e.date)
        return events

    def _to_permission_response(self, permission: MatterContactPermission, matter: Matter, contact) -> MatterContactPermissionResponse:
        return MatterContactPermissionResponse(
            id=permission.id,
            matter_id=matter.id,
            matter_title=matter.title,
            client_contact_id=contact.id,
            contact_name=f"{contact.first_name} {contact.last_name}",
            contact_email=contact.email,
            permission_level=permission.permission_level,
            created_at=permission.created_at,
            updated_at=permission.updated_at,
        )

    def set_contact_permission(
        self, matter_id, firm_id, actor_id, request: SetContactPermissionRequest
    ) -> MatterContactPermissionResponse:
        matter = self.get_matter(matter_id, firm_id)  # ownership check

        contact = self.client_repository.get_contact_by_id(request.client_contact_id)
        if not contact or str(contact.client_id) != str(matter.client_id):
            raise ContactNotFoundForMatterPermission()

        permission = self.repository.get_contact_permission(matter_id, request.client_contact_id)
        if permission:
            permission.permission_level = request.permission_level
        else:
            permission = MatterContactPermission(
                matter_id=matter.id,
                client_contact_id=request.client_contact_id,
                permission_level=request.permission_level,
            )
            self.repository.create_contact_permission(permission)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            firm_id=firm_id,
            action=audit_actions.MATTER_CONTACT_PERMISSION_SET,
            target_type="matter_contact_permission",
            target_id=permission.id,
            details={"client_contact_id": str(contact.id), "permission_level": request.permission_level.value},
        )
        self.notifications.notify(
            recipient_type=RecipientType.CLIENT_CONTACT,
            recipient_id=contact.id,
            type="matter.permission_updated",
            title=f'Your access on "{matter.title}" was updated',
            body=f"You now have {request.permission_level.value} access.",
            target_type="matter",
            target_id=matter.id,
        )
        self.db.commit()
        self.db.refresh(permission)
        return self._to_permission_response(permission, matter, contact)

    def list_contact_permissions(self, matter_id, firm_id) -> list[MatterContactPermissionResponse]:
        matter = self.get_matter(matter_id, firm_id)  # ownership check
        permissions = self.repository.list_contact_permissions_for_matter(matter_id)
        contacts_by_id = {c.id: c for c in self.client_repository.list_contacts_for_client(matter.client_id)}
        return [
            self._to_permission_response(p, matter, contacts_by_id[p.client_contact_id])
            for p in permissions
            if p.client_contact_id in contacts_by_id
        ]

    def remove_contact_permission(self, matter_id, firm_id, actor_id, client_contact_id) -> None:
        matter = self.get_matter(matter_id, firm_id)  # ownership check
        permission = self.repository.get_contact_permission(matter_id, client_contact_id)
        if not permission:
            raise MatterContactPermissionNotFound()

        self.repository.delete_contact_permission(permission)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            firm_id=firm_id,
            action=audit_actions.MATTER_CONTACT_PERMISSION_REMOVED,
            target_type="matter_contact_permission",
            target_id=permission.id,
            details={"client_contact_id": str(client_contact_id), "matter_id": str(matter.id)},
        )
        self.db.commit()

    def list_my_contact_permissions(self, client_id) -> list[MatterContactPermissionResponse]:
        rows = self.repository.list_contact_permissions_for_client(client_id)
        if not rows:
            return []
        contacts_by_id = {c.id: c for c in self.client_repository.list_contacts_for_client(client_id)}
        return [
            self._to_permission_response(p, matter, contacts_by_id[p.client_contact_id])
            for p, matter in rows
            if p.client_contact_id in contacts_by_id
        ]

    def _eligible_approver_ids(self, firm_id, matter_id, exclude_id=None) -> list[uuid.UUID]:
        """Firm admins, plus this matter's lead-lawyer assignees — active users only."""
        firm_users = {u.id: u for u in self.auth_repository.list_by_firm(firm_id)}
        admin_ids = {u.id for u in firm_users.values() if u.role == UserRole.ADMIN and u.is_active}
        lead_lawyer_ids = {
            a.user_id
            for a in self.repository.list_assignments_for_matter(matter_id)
            if a.role_on_matter == MatterRole.LEAD_LAWYER and a.user_id in firm_users and firm_users[a.user_id].is_active
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
        self, matter_id, firm_id, actor_id, request: RequestMatterApprovalRequest
    ) -> MatterApproval:
        matter = self.get_matter(matter_id, firm_id)
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
            firm_id=firm_id,
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
            for approver_id in self._eligible_approver_ids(firm_id, matter_id, exclude_id=actor_id)
        ])
        self.db.commit()
        self.db.refresh(approval)
        return approval

    def list_approvals(self, matter_id, firm_id) -> list[MatterApproval]:
        self.get_matter(matter_id, firm_id)  # ownership check
        return self.repository.list_approvals_for_matter(matter_id)

    def list_pending_approvals(self, firm_id) -> list[MatterApproval]:
        return self.repository.list_pending_approvals_for_firm(firm_id)

    def decide_approval(
        self, matter_id, approval_id, firm_id, actor_id, actor_role, request: DecideMatterApprovalRequest
    ) -> MatterApproval:
        matter = self.get_matter(matter_id, firm_id)

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
            firm_id=firm_id,
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

    def generate_document_from_template(
        self, matter_id, firm_id, actor_id, request: GenerateDocumentRequest
    ) -> MatterDocument:
        # Local imports: intake/service.py imports MatterService at module level, so
        # importing intake (or templates, for symmetry) at module level here would be
        # circular. Same pattern already used above for app.exceptions.templates.
        from app.modules.templates.repository import TemplateRepository
        from app.modules.templates.render import normalize_key, render_body
        from app.exceptions.templates import TemplateNotFound, TemplateHasNoBody
        from app.modules.intake.repository import IntakeRepository
        from app.modules.intake.models import IntakeFieldType
        from app.exceptions.intake import IntakeSubmissionNotFound
        from xhtml2pdf import pisa
        from io import BytesIO

        matter = self.get_matter(matter_id, firm_id)

        template_repository = TemplateRepository(self.db)
        template = template_repository.get_by_id(request.template_id)
        if not template or str(template.firm_id) != str(firm_id):
            raise TemplateNotFound()
        if not template.body:
            raise TemplateHasNoBody()

        intake_repository = IntakeRepository(self.db)
        submission = intake_repository.get_submission_by_id(request.intake_submission_id)
        if not submission or str(submission.firm_id) != str(firm_id):
            raise IntakeSubmissionNotFound()
        if str(submission.client_id) != str(matter.client_id):
            raise IntakeSubmissionClientMismatch()

        values: dict[str, str] = {}
        for answer, field in intake_repository.list_answers_with_fields(submission.id):
            if field.field_type == IntakeFieldType.FILE:
                values[normalize_key(field.label)] = "(file attached)"
            else:
                values[normalize_key(field.label)] = answer.value or ""

        client = self.client_repository.get_client_by_id(matter.client_id)
        values.setdefault("client_name", client.company_name if client else "")
        values.setdefault("matter_title", matter.title)
        values.setdefault("today", date.today().isoformat())

        rendered_html = render_body(template.body, values)

        pdf_buffer = BytesIO()
        pisa.CreatePDF(rendered_html, dest=pdf_buffer)
        pdf_bytes = pdf_buffer.getvalue()

        title = request.title or f"{template.title}: {matter.title}"
        document = self.upload_matter_document(
            matter_id=matter.id,
            title=title,
            file_bytes=pdf_bytes,
            original_filename=f"{title}.pdf",
            content_type="application/pdf",
            firm_id=firm_id,
            uploaded_by=actor_id,
        )

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            firm_id=firm_id,
            action=audit_actions.MATTER_DOCUMENT_GENERATED,
            target_type="matter_document",
            target_id=document.id,
            details={"template_id": str(template.id), "intake_submission_id": str(submission.id)},
        )
        self.db.commit()
        return document