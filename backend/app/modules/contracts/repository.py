from sqlalchemy import select
from sqlalchemy.orm import Session
from app.modules.contracts.models import ContractDocument, ContractTask, ContractMessage, ContractApproval, ApprovalStatus

from app.modules.contracts.models import Contract, ContractAssignment


class ContractRepository:

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, contract_id) -> Contract | None:
        return self.db.scalar(select(Contract).where(Contract.id == contract_id))

    def list_by_org(self, org_id) -> list[Contract]:
        return list(self.db.scalars(select(Contract).where(Contract.org_id == org_id)))

    def create(self, contract: Contract) -> Contract:
        self.db.add(contract)
        self.db.flush()
        return contract

    def create_assignment(self, assignment: ContractAssignment) -> ContractAssignment:
        self.db.add(assignment)
        self.db.flush()
        return assignment

    def get_assignment(self, contract_id, user_id, role_on_contract) -> ContractAssignment | None:
        return self.db.scalar(
            select(ContractAssignment).where(
                ContractAssignment.contract_id == contract_id,
                ContractAssignment.user_id == user_id,
                ContractAssignment.role_on_contract == role_on_contract,
            )
        )

    def list_assignments_for_contract(self, contract_id) -> list[ContractAssignment]:
        return list(
            self.db.scalars(select(ContractAssignment).where(ContractAssignment.contract_id == contract_id))
        )
    def count_contracts_for_org(self, org_id) -> int:
        from sqlalchemy import func
        return self.db.scalar(select(func.count()).select_from(Contract).where(Contract.org_id == org_id))
    def create_document(self, document: ContractDocument) -> ContractDocument:
        self.db.add(document)
        self.db.flush()
        return document

    def get_document_by_id(self, document_id) -> ContractDocument | None:
        return self.db.scalar(select(ContractDocument).where(ContractDocument.id == document_id))

    def get_latest_version(self, contract_id, title: str) -> ContractDocument | None:
        statement = (
            select(ContractDocument)
            .where(ContractDocument.contract_id == contract_id, ContractDocument.title == title)
            .order_by(ContractDocument.version.desc())
        )
        return self.db.scalar(statement)

    def list_documents_for_contract(self, contract_id) -> list[ContractDocument]:
        return list(self.db.scalars(select(ContractDocument).where(ContractDocument.contract_id == contract_id)))

    def delete_document(self, document: ContractDocument):
        self.db.delete(document)
        self.db.flush()

    def delete_assignment(self, assignment: ContractAssignment):
        self.db.delete(assignment)
        self.db.flush()

    def delete_contract(self, contract: Contract):
        self.db.delete(contract)
        self.db.flush()

    def create_task(self, task: ContractTask) -> ContractTask:
        self.db.add(task)
        self.db.flush()
        return task

    def get_task_by_id(self, task_id) -> ContractTask | None:
        return self.db.scalar(select(ContractTask).where(ContractTask.id == task_id))

    def list_tasks_for_contract(self, contract_id) -> list[ContractTask]:
        return list(self.db.scalars(select(ContractTask).where(ContractTask.contract_id == contract_id)))

    def delete_task(self, task: ContractTask):
        self.db.delete(task)
        self.db.flush()

    def count_all_contracts(self) -> int:
        from sqlalchemy import func
        return self.db.scalar(select(func.count()).select_from(Contract))

    def count_all_contracts_by_status(self) -> dict[str, int]:
        from sqlalchemy import func
        statement = select(Contract.status, func.count()).group_by(Contract.status)
        return {status.value: count for status, count in self.db.execute(statement).all()}

    def list_contracts_with_deadline_in_range(self, org_id, start, end) -> list[Contract]:
        statement = select(Contract).where(
            Contract.org_id == org_id,
            Contract.due_date.is_not(None),
            Contract.due_date >= start,
            Contract.due_date <= end,
        )
        return list(self.db.scalars(statement))

    def list_tasks_with_due_date_in_range(self, org_id, start, end) -> list[tuple[ContractTask, Contract]]:
        statement = (
            select(ContractTask, Contract)
            .join(Contract, ContractTask.contract_id == Contract.id)
            .where(
                Contract.org_id == org_id,
                ContractTask.due_date.is_not(None),
                ContractTask.due_date >= start,
                ContractTask.due_date <= end,
            )
        )
        return list(self.db.execute(statement).all())

    def list_assignments_for_org(self, org_id) -> list[tuple[ContractAssignment, Contract]]:
        statement = (
            select(ContractAssignment, Contract)
            .join(Contract, ContractAssignment.contract_id == Contract.id)
            .where(Contract.org_id == org_id)
        )
        return list(self.db.execute(statement).all())

    def list_tasks_for_org(self, org_id) -> list[tuple[ContractTask, Contract]]:
        statement = (
            select(ContractTask, Contract)
            .join(Contract, ContractTask.contract_id == Contract.id)
            .where(Contract.org_id == org_id)
        )
        return list(self.db.execute(statement).all())

    def list_recent_documents_for_org(self, org_id, limit: int) -> list[tuple[ContractDocument, Contract]]:
        statement = (
            select(ContractDocument, Contract)
            .join(Contract, ContractDocument.contract_id == Contract.id)
            .where(Contract.org_id == org_id)
            .order_by(ContractDocument.created_at.desc())
            .limit(limit)
        )
        return list(self.db.execute(statement).all())

    def list_recent_messages_for_org(self, org_id, limit: int) -> list[tuple[ContractMessage, Contract]]:
        statement = (
            select(ContractMessage, Contract)
            .join(Contract, ContractMessage.contract_id == Contract.id)
            .where(Contract.org_id == org_id)
            .order_by(ContractMessage.created_at.desc())
            .limit(limit)
        )
        return list(self.db.execute(statement).all())

    def create_message(self, message: ContractMessage) -> ContractMessage:
        self.db.add(message)
        self.db.flush()
        return message

    def get_message_by_id(self, message_id) -> ContractMessage | None:
        return self.db.scalar(select(ContractMessage).where(ContractMessage.id == message_id))

    def list_messages_for_contract(self, contract_id) -> list[ContractMessage]:
        statement = select(ContractMessage).where(ContractMessage.contract_id == contract_id).order_by(
            ContractMessage.created_at.asc()
        )
        return list(self.db.scalars(statement))

    def delete_message(self, message: ContractMessage):
        self.db.delete(message)
        self.db.flush()

    def create_approval(self, approval: ContractApproval) -> ContractApproval:
        self.db.add(approval)
        self.db.flush()
        return approval

    def get_approval_by_id(self, approval_id) -> ContractApproval | None:
        return self.db.scalar(select(ContractApproval).where(ContractApproval.id == approval_id))

    def get_pending_approval(self, contract_id) -> ContractApproval | None:
        return self.db.scalar(
            select(ContractApproval).where(
                ContractApproval.contract_id == contract_id,
                ContractApproval.status == ApprovalStatus.PENDING,
            )
        )

    def list_approvals_for_contract(self, contract_id) -> list[ContractApproval]:
        statement = (
            select(ContractApproval)
            .where(ContractApproval.contract_id == contract_id)
            .order_by(ContractApproval.created_at.desc())
        )
        return list(self.db.scalars(statement))

    def list_pending_approvals_for_org(self, org_id) -> list[ContractApproval]:
        statement = (
            select(ContractApproval)
            .join(Contract, ContractApproval.contract_id == Contract.id)
            .where(Contract.org_id == org_id, ContractApproval.status == ApprovalStatus.PENDING)
        )
        return list(self.db.scalars(statement))