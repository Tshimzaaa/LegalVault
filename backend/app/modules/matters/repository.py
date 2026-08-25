from sqlalchemy import select
from sqlalchemy.orm import Session
from app.modules.matters.models import MatterDocument, MatterTask, MatterMessage, MatterContactPermission, MatterApproval, ApprovalStatus

from app.modules.matters.models import Matter, MatterAssignment


class MatterRepository:

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, matter_id) -> Matter | None:
        return self.db.scalar(select(Matter).where(Matter.id == matter_id))

    def list_by_firm(self, firm_id) -> list[Matter]:
        return list(self.db.scalars(select(Matter).where(Matter.firm_id == firm_id)))

    def list_by_client(self, client_id) -> list[Matter]:
        return list(self.db.scalars(select(Matter).where(Matter.client_id == client_id)))

    def create(self, matter: Matter) -> Matter:
        self.db.add(matter)
        self.db.flush()
        return matter

    def create_assignment(self, assignment: MatterAssignment) -> MatterAssignment:
        self.db.add(assignment)
        self.db.flush()
        return assignment

    def get_assignment(self, matter_id, user_id, role_on_matter) -> MatterAssignment | None:
        return self.db.scalar(
            select(MatterAssignment).where(
                MatterAssignment.matter_id == matter_id,
                MatterAssignment.user_id == user_id,
                MatterAssignment.role_on_matter == role_on_matter,
            )
        )

    def list_assignments_for_matter(self, matter_id) -> list[MatterAssignment]:
        return list(
            self.db.scalars(select(MatterAssignment).where(MatterAssignment.matter_id == matter_id))
        )
    def count_matters_for_firm(self, firm_id) -> int:
        from sqlalchemy import func
        return self.db.scalar(select(func.count()).select_from(Matter).where(Matter.firm_id == firm_id))
    def create_document(self, document: MatterDocument) -> MatterDocument:
        self.db.add(document)
        self.db.flush()
        return document

    def get_document_by_id(self, document_id) -> MatterDocument | None:
        return self.db.scalar(select(MatterDocument).where(MatterDocument.id == document_id))

    def get_latest_version(self, matter_id, title: str) -> MatterDocument | None:
        statement = (
            select(MatterDocument)
            .where(MatterDocument.matter_id == matter_id, MatterDocument.title == title)
            .order_by(MatterDocument.version.desc())
        )
        return self.db.scalar(statement)

    def list_documents_for_matter(self, matter_id) -> list[MatterDocument]:
        return list(self.db.scalars(select(MatterDocument).where(MatterDocument.matter_id == matter_id)))

    def delete_document(self, document: MatterDocument):
        self.db.delete(document)
        self.db.flush()

    def delete_assignment(self, assignment: MatterAssignment):
        self.db.delete(assignment)
        self.db.flush()

    def delete_matter(self, matter: Matter):
        self.db.delete(matter)
        self.db.flush()

    def create_task(self, task: MatterTask) -> MatterTask:
        self.db.add(task)
        self.db.flush()
        return task

    def get_task_by_id(self, task_id) -> MatterTask | None:
        return self.db.scalar(select(MatterTask).where(MatterTask.id == task_id))

    def list_tasks_for_matter(self, matter_id) -> list[MatterTask]:
        return list(self.db.scalars(select(MatterTask).where(MatterTask.matter_id == matter_id)))

    def delete_task(self, task: MatterTask):
        self.db.delete(task)
        self.db.flush()

    def count_all_matters(self) -> int:
        from sqlalchemy import func
        return self.db.scalar(select(func.count()).select_from(Matter))

    def count_all_matters_by_status(self) -> dict[str, int]:
        from sqlalchemy import func
        statement = select(Matter.status, func.count()).group_by(Matter.status)
        return {status.value: count for status, count in self.db.execute(statement).all()}

    def list_matters_with_deadline_in_range(self, firm_id, start, end) -> list[Matter]:
        statement = select(Matter).where(
            Matter.firm_id == firm_id,
            Matter.due_date.is_not(None),
            Matter.due_date >= start,
            Matter.due_date <= end,
        )
        return list(self.db.scalars(statement))

    def list_tasks_with_due_date_in_range(self, firm_id, start, end) -> list[tuple[MatterTask, Matter]]:
        statement = (
            select(MatterTask, Matter)
            .join(Matter, MatterTask.matter_id == Matter.id)
            .where(
                Matter.firm_id == firm_id,
                MatterTask.due_date.is_not(None),
                MatterTask.due_date >= start,
                MatterTask.due_date <= end,
            )
        )
        return list(self.db.execute(statement).all())

    def list_assignments_for_firm(self, firm_id) -> list[tuple[MatterAssignment, Matter]]:
        statement = (
            select(MatterAssignment, Matter)
            .join(Matter, MatterAssignment.matter_id == Matter.id)
            .where(Matter.firm_id == firm_id)
        )
        return list(self.db.execute(statement).all())

    def list_tasks_for_firm(self, firm_id) -> list[tuple[MatterTask, Matter]]:
        statement = (
            select(MatterTask, Matter)
            .join(Matter, MatterTask.matter_id == Matter.id)
            .where(Matter.firm_id == firm_id)
        )
        return list(self.db.execute(statement).all())

    def list_recent_documents_for_firm(self, firm_id, limit: int) -> list[tuple[MatterDocument, Matter]]:
        statement = (
            select(MatterDocument, Matter)
            .join(Matter, MatterDocument.matter_id == Matter.id)
            .where(Matter.firm_id == firm_id)
            .order_by(MatterDocument.created_at.desc())
            .limit(limit)
        )
        return list(self.db.execute(statement).all())

    def list_recent_messages_for_firm(self, firm_id, limit: int) -> list[tuple[MatterMessage, Matter]]:
        statement = (
            select(MatterMessage, Matter)
            .join(Matter, MatterMessage.matter_id == Matter.id)
            .where(Matter.firm_id == firm_id)
            .order_by(MatterMessage.created_at.desc())
            .limit(limit)
        )
        return list(self.db.execute(statement).all())

    def list_recent_documents_for_client(self, client_id, limit: int) -> list[tuple[MatterDocument, Matter]]:
        statement = (
            select(MatterDocument, Matter)
            .join(Matter, MatterDocument.matter_id == Matter.id)
            .where(Matter.client_id == client_id, Matter.is_visible_to_client.is_(True))
            .order_by(MatterDocument.created_at.desc())
            .limit(limit)
        )
        return list(self.db.execute(statement).all())

    def list_recent_messages_for_client(self, client_id, limit: int) -> list[tuple[MatterMessage, Matter]]:
        statement = (
            select(MatterMessage, Matter)
            .join(Matter, MatterMessage.matter_id == Matter.id)
            .where(Matter.client_id == client_id, Matter.is_visible_to_client.is_(True))
            .order_by(MatterMessage.created_at.desc())
            .limit(limit)
        )
        return list(self.db.execute(statement).all())

    def list_visible_matters_with_deadline_in_range(self, client_id, start, end) -> list[Matter]:
        statement = select(Matter).where(
            Matter.client_id == client_id,
            Matter.is_visible_to_client.is_(True),
            Matter.due_date.is_not(None),
            Matter.due_date >= start,
            Matter.due_date <= end,
        )
        return list(self.db.scalars(statement))

    def create_message(self, message: MatterMessage) -> MatterMessage:
        self.db.add(message)
        self.db.flush()
        return message

    def get_message_by_id(self, message_id) -> MatterMessage | None:
        return self.db.scalar(select(MatterMessage).where(MatterMessage.id == message_id))

    def list_messages_for_matter(self, matter_id) -> list[MatterMessage]:
        statement = select(MatterMessage).where(MatterMessage.matter_id == matter_id).order_by(
            MatterMessage.created_at.asc()
        )
        return list(self.db.scalars(statement))

    def delete_message(self, message: MatterMessage):
        self.db.delete(message)
        self.db.flush()

    def get_contact_permission(self, matter_id, client_contact_id) -> MatterContactPermission | None:
        return self.db.scalar(
            select(MatterContactPermission).where(
                MatterContactPermission.matter_id == matter_id,
                MatterContactPermission.client_contact_id == client_contact_id,
            )
        )

    def create_contact_permission(self, permission: MatterContactPermission) -> MatterContactPermission:
        self.db.add(permission)
        self.db.flush()
        return permission

    def list_contact_permissions_for_matter(self, matter_id) -> list[MatterContactPermission]:
        return list(
            self.db.scalars(select(MatterContactPermission).where(MatterContactPermission.matter_id == matter_id))
        )

    def delete_contact_permission(self, permission: MatterContactPermission):
        self.db.delete(permission)
        self.db.flush()

    def list_contact_permissions_for_client(self, client_id) -> list[tuple[MatterContactPermission, Matter]]:
        statement = (
            select(MatterContactPermission, Matter)
            .join(Matter, MatterContactPermission.matter_id == Matter.id)
            .where(Matter.client_id == client_id, Matter.is_visible_to_client.is_(True))
        )
        return list(self.db.execute(statement).all())

    def create_approval(self, approval: MatterApproval) -> MatterApproval:
        self.db.add(approval)
        self.db.flush()
        return approval

    def get_approval_by_id(self, approval_id) -> MatterApproval | None:
        return self.db.scalar(select(MatterApproval).where(MatterApproval.id == approval_id))

    def get_pending_approval(self, matter_id) -> MatterApproval | None:
        return self.db.scalar(
            select(MatterApproval).where(
                MatterApproval.matter_id == matter_id,
                MatterApproval.status == ApprovalStatus.PENDING,
            )
        )

    def list_approvals_for_matter(self, matter_id) -> list[MatterApproval]:
        statement = (
            select(MatterApproval)
            .where(MatterApproval.matter_id == matter_id)
            .order_by(MatterApproval.created_at.desc())
        )
        return list(self.db.scalars(statement))

    def list_pending_approvals_for_firm(self, firm_id) -> list[MatterApproval]:
        statement = (
            select(MatterApproval)
            .join(Matter, MatterApproval.matter_id == Matter.id)
            .where(Matter.firm_id == firm_id, MatterApproval.status == ApprovalStatus.PENDING)
        )
        return list(self.db.scalars(statement))