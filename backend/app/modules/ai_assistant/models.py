from uuid import UUID

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import BaseModel


class AiConversation(BaseModel):
    """A staff chat thread with the "Learned Friend" AI assistant."""

    __tablename__ = "ai_conversations"

    org_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )

    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )

    # Set from the first user message so the conversation list has something
    # readable to show; never re-derived after that.
    title: Mapped[str] = mapped_column(String(200), nullable=False)


class AiMessage(BaseModel):
    """A single turn in an AiConversation. `role` is "user" or "assistant"."""

    __tablename__ = "ai_messages"

    conversation_id: Mapped[UUID] = mapped_column(
        ForeignKey("ai_conversations.id"),
        nullable=False,
        index=True,
    )

    # Denormalized from the parent conversation so the RLS policy can check it
    # directly on this table too, without a join.
    org_id: Mapped[UUID] = mapped_column(
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )

    role: Mapped[str] = mapped_column(String(20), nullable=False)

    content: Mapped[str] = mapped_column(Text, nullable=False)
