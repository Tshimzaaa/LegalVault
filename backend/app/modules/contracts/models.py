from datetime import date, datetime
from uuid import UUID

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING
import enum

from app.database.base import BaseModel

if TYPE_CHECKING:
    from app.modules.auth.models.organization import Organization
    from app.modules.auth.models.user import User


class ContractStage(str, enum.Enum):
    INTAKE = "intake"
    IN_REVIEW = "in_review"
    AWAITING_SIGNATURE = "awaiting_signature"
    SIGNED = "signed"
    CLOSED = "closed"
    DECLINED = "declined"


class ContractRole(str, enum.Enum):
    LEAD_LAWYER = "lead_lawyer"
    PARALEGAL = "paralegal"
    SECRETARY = "secretary"
    REVIEWER = "reviewer"


class TaskStatus(str, enum.Enum):
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    DONE = "done"


class MessageAuthorType(str, enum.Enum):
    STAFF = "staff"


class ApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class Contract(BaseModel):
    __tablename__ = "contracts"

    org_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)

    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[ContractStage] = mapped_column(
        Enum(ContractStage),
        default=ContractStage.INTAKE,
        nullable=False,
    )

    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    assignments: Mapped[list["ContractAssignment"]] = relationship(
        "ContractAssignment",
        back_populates="contract",
    )

    tasks: Mapped[list["ContractTask"]] = relationship(
        "ContractTask",
        back_populates="contract",
    )

    messages: Mapped[list["ContractMessage"]] = relationship(
        "ContractMessage",
        back_populates="contract",
    )


class ContractAssignment(BaseModel):
    __tablename__ = "contract_assignments"

    contract_id: Mapped[UUID] = mapped_column(
        ForeignKey("contracts.id"),
        nullable=False,
        index=True,
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    role_on_contract: Mapped[ContractRole] = mapped_column(
        Enum(ContractRole),
        nullable=False,
    )

    contract: Mapped["Contract"] = relationship(
        "Contract",
        back_populates="assignments",
    )


class ContractDocument(BaseModel):
    __tablename__ = "contract_documents"

    contract_id: Mapped[UUID] = mapped_column(
        ForeignKey("contracts.id"),
        nullable=False,
        index=True,
    )

    uploaded_by: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)

    version: Mapped[int] = mapped_column(nullable=False, default=1)

    file_key: Mapped[str] = mapped_column(String(500), nullable=False)

    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)

    content_type: Mapped[str] = mapped_column(String(100), nullable=False)


class ContractTask(BaseModel):
    __tablename__ = "contract_tasks"

    contract_id: Mapped[UUID] = mapped_column(
        ForeignKey("contracts.id"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)

    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    assigned_to: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
        index=True,
    )

    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus),
        default=TaskStatus.TODO,
        nullable=False,
    )

    contract: Mapped["Contract"] = relationship(
        "Contract",
        back_populates="tasks",
    )


class ContractMessage(BaseModel):
    __tablename__ = "contract_messages"

    contract_id: Mapped[UUID] = mapped_column(
        ForeignKey("contracts.id"),
        nullable=False,
        index=True,
    )

    author_type: Mapped[MessageAuthorType] = mapped_column(
        Enum(MessageAuthorType),
        nullable=False,
    )

    # Not a ForeignKey — a message should outlive the author's account
    # (author_name below keeps it displayable even after the account is gone).
    author_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)

    author_name: Mapped[str] = mapped_column(String(200), nullable=False)

    body: Mapped[str] = mapped_column(Text, nullable=False)

    contract: Mapped["Contract"] = relationship(
        "Contract",
        back_populates="messages",
    )


class ContractApproval(BaseModel):
    __tablename__ = "contract_approvals"

    contract_id: Mapped[UUID] = mapped_column(
        ForeignKey("contracts.id"),
        nullable=False,
        index=True,
    )

    requested_by: Mapped[UUID] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    from_status: Mapped[ContractStage] = mapped_column(Enum(ContractStage), nullable=False)

    to_status: Mapped[ContractStage] = mapped_column(Enum(ContractStage), nullable=False)

    status: Mapped[ApprovalStatus] = mapped_column(
        Enum(ApprovalStatus),
        default=ApprovalStatus.PENDING,
        nullable=False,
        index=True,
    )

    decided_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)

    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    decision_note: Mapped[str | None] = mapped_column(String(500), nullable=True)