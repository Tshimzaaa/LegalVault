from datetime import date, datetime
from uuid import UUID

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING
import enum

from app.database.base import BaseModel

if TYPE_CHECKING:
    from app.modules.auth.models.law_firm import LawFirm
    from app.modules.clients.models import Client, ClientContact
    from app.modules.auth.models.user import User


class MatterStatus(str, enum.Enum):
    INTAKE = "intake"
    IN_REVIEW = "in_review"
    AWAITING_SIGNATURE = "awaiting_signature"
    SIGNED = "signed"
    CLOSED = "closed"
    DECLINED = "declined"


class MatterRole(str, enum.Enum):
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
    CLIENT_CONTACT = "client_contact"


class ContactPermissionLevel(str, enum.Enum):
    OWNER = "owner"
    EDITOR = "editor"
    VIEWER = "viewer"


class ApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class Matter(BaseModel):
    __tablename__ = "matters"

    firm_id: Mapped[UUID] = mapped_column(
        ForeignKey("law_firms.id"),
        nullable=False,
        index=True,
    )

    client_id: Mapped[UUID] = mapped_column(
        ForeignKey("clients.id"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)

    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    status: Mapped[MatterStatus] = mapped_column(
        Enum(MatterStatus),
        default=MatterStatus.INTAKE,
        nullable=False,
    )

    is_visible_to_client: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    assignments: Mapped[list["MatterAssignment"]] = relationship(
        "MatterAssignment",
        back_populates="matter",
    )

    tasks: Mapped[list["MatterTask"]] = relationship(
        "MatterTask",
        back_populates="matter",
    )

    messages: Mapped[list["MatterMessage"]] = relationship(
        "MatterMessage",
        back_populates="matter",
    )


class MatterAssignment(BaseModel):
    __tablename__ = "matter_assignments"

    matter_id: Mapped[UUID] = mapped_column(
        ForeignKey("matters.id"),
        nullable=False,
        index=True,
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
    )

    role_on_matter: Mapped[MatterRole] = mapped_column(
        Enum(MatterRole),
        nullable=False,
    )

    matter: Mapped["Matter"] = relationship(
        "Matter",
        back_populates="assignments",
    )


class MatterDocument(BaseModel):
    __tablename__ = "matter_documents"

    matter_id: Mapped[UUID] = mapped_column(
        ForeignKey("matters.id"),
        nullable=False,
        index=True,
    )

    uploaded_by: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )

    uploaded_by_contact_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("client_contacts.id"),
        nullable=True,
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)

    version: Mapped[int] = mapped_column(nullable=False, default=1)

    file_key: Mapped[str] = mapped_column(String(500), nullable=False)

    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)

    content_type: Mapped[str] = mapped_column(String(100), nullable=False)


class MatterTask(BaseModel):
    __tablename__ = "matter_tasks"

    matter_id: Mapped[UUID] = mapped_column(
        ForeignKey("matters.id"),
        nullable=False,
        index=True,
    )

    title: Mapped[str] = mapped_column(String(200), nullable=False)

    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    assigned_to: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True,
    )

    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus),
        default=TaskStatus.TODO,
        nullable=False,
    )

    matter: Mapped["Matter"] = relationship(
        "Matter",
        back_populates="tasks",
    )


class MatterMessage(BaseModel):
    __tablename__ = "matter_messages"

    matter_id: Mapped[UUID] = mapped_column(
        ForeignKey("matters.id"),
        nullable=False,
        index=True,
    )

    author_type: Mapped[MessageAuthorType] = mapped_column(
        Enum(MessageAuthorType),
        nullable=False,
    )

    # Not a ForeignKey — the author is a User or a ClientContact depending on
    # author_type, and a message should outlive either account (author_name below
    # keeps it displayable even after the author's account is gone).
    author_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)

    author_name: Mapped[str] = mapped_column(String(200), nullable=False)

    body: Mapped[str] = mapped_column(Text, nullable=False)

    matter: Mapped["Matter"] = relationship(
        "Matter",
        back_populates="messages",
    )


class MatterContactPermission(BaseModel):
    __tablename__ = "matter_contact_permissions"
    __table_args__ = (UniqueConstraint("matter_id", "client_contact_id"),)

    matter_id: Mapped[UUID] = mapped_column(
        ForeignKey("matters.id"),
        nullable=False,
        index=True,
    )

    client_contact_id: Mapped[UUID] = mapped_column(
        ForeignKey("client_contacts.id"),
        nullable=False,
        index=True,
    )

    permission_level: Mapped[ContactPermissionLevel] = mapped_column(
        Enum(ContactPermissionLevel),
        default=ContactPermissionLevel.VIEWER,
        nullable=False,
    )


class MatterApproval(BaseModel):
    __tablename__ = "matter_approvals"

    matter_id: Mapped[UUID] = mapped_column(
        ForeignKey("matters.id"),
        nullable=False,
        index=True,
    )

    requested_by: Mapped[UUID] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
    )

    from_status: Mapped[MatterStatus] = mapped_column(Enum(MatterStatus), nullable=False)

    to_status: Mapped[MatterStatus] = mapped_column(Enum(MatterStatus), nullable=False)

    status: Mapped[ApprovalStatus] = mapped_column(
        Enum(ApprovalStatus),
        default=ApprovalStatus.PENDING,
        nullable=False,
        index=True,
    )

    decided_by: Mapped[UUID | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    decision_note: Mapped[str | None] = mapped_column(String(500), nullable=True)