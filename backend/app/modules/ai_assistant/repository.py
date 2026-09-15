from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.ai_assistant.models import AiConversation, AiMessage


class AiAssistantRepository:

    def __init__(self, db: Session):
        self.db = db

    def create_conversation(self, conversation: AiConversation) -> AiConversation:
        self.db.add(conversation)
        self.db.flush()
        return conversation

    def get_conversation_by_id(self, conversation_id) -> AiConversation | None:
        return self.db.scalar(select(AiConversation).where(AiConversation.id == conversation_id))

    def list_conversations_by_user(self, user_id) -> list[AiConversation]:
        statement = (
            select(AiConversation)
            .where(AiConversation.user_id == user_id)
            .order_by(AiConversation.created_at.desc())
        )
        return list(self.db.scalars(statement))

    def add_message(self, message: AiMessage) -> AiMessage:
        self.db.add(message)
        self.db.flush()
        return message

    def list_messages(self, conversation_id) -> list[AiMessage]:
        statement = (
            select(AiMessage)
            .where(AiMessage.conversation_id == conversation_id)
            .order_by(AiMessage.created_at)
        )
        return list(self.db.scalars(statement))
