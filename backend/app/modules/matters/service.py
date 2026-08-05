import uuid
from sqlalchemy.orm import Session

from app.modules.matters.repository import MatterRepository
from app.modules.matters.models import Matter, MatterAssignment, MatterDocument, MatterTask
from app.modules.matters.schemas import (
    CreateMatterRequest,
    UpdateMatterStatusRequest,
    UpdateMatterVisibilityRequest,
    AssignStaffRequest,
    CreateMatterTaskRequest,
    UpdateMatterTaskRequest,
)
from app.exceptions.matters import (
    MatterNotFound,
    ClientNotFoundForMatter,
    StaffAlreadyAssigned,
    MatterDocumentNotFound,
    UserNotFoundForAssignment,
    MatterTaskNotFound,
)
from app.modules.clients.repository import ClientRepository
from app.modules.auth.repository import AuthRepository
from app.core.storage import upload_file, get_download_url
from app.modules.audit.service import AuditService
from app.modules.audit.models import ActorType
from app.modules.audit import actions as audit_actions


ALLOWED_DOCUMENT_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
}


class MatterService:

    def __init__(self, db: Session):
        self.db = db
        self.repository = MatterRepository(db)
        self.client_repository = ClientRepository(db)
        self.auth_repository = AuthRepository(db)
        self.audit = AuditService(db)

    def create_matter(self, firm_id, actor_id, request: CreateMatterRequest) -> Matter:
        client = self.client_repository.get_client_by_id(request.client_id)
        if not client or str(client.firm_id) != str(firm_id):
            raise ClientNotFoundForMatter()

        matter = Matter(
            firm_id=firm_id,
            client_id=request.client_id,
            title=request.title,
            description=request.description,
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

    def get_matter(self, matter_id, firm_id) -> Matter:
        matter = self.repository.get_by_id(matter_id)
        if not matter or str(matter.firm_id) != str(firm_id):
            raise MatterNotFound()
        return matter

    def list_matters_for_firm(self, firm_id) -> list[Matter]:
        return self.repository.list_by_firm(firm_id)

    def update_status(self, matter_id, firm_id, actor_id, request: UpdateMatterStatusRequest) -> Matter:
        matter = self.get_matter(matter_id, firm_id)
        previous_status = matter.status
        matter.status = request.status

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            firm_id=firm_id,
            action=audit_actions.MATTER_STATUS_UPDATED,
            target_type="matter",
            target_id=matter.id,
            details={"from": previous_status.value, "to": request.status.value},
        )
        self.db.commit()
        return matter

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
        self.db.commit()
        return matter

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
        self.db.commit()
        return task

    def list_tasks(self, matter_id, firm_id) -> list[MatterTask]:
        self.get_matter(matter_id, firm_id)  # ownership check
        return self.repository.list_tasks_for_matter(matter_id)

    def update_task(self, matter_id, task_id, firm_id, actor_id, request: UpdateMatterTaskRequest) -> MatterTask:
        self.get_matter(matter_id, firm_id)  # ownership check

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
        self.db.commit()
        return task

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