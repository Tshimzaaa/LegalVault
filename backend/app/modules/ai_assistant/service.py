from sqlalchemy.orm import Session

from app.modules.ai_assistant.repository import AiAssistantRepository
from app.modules.ai_assistant.models import AiConversation, AiMessage
from app.modules.fallback_clauses.repository import FallbackClauseRepository
from app.exceptions.ai_assistant import ConversationNotFound
from app.core.llm_client import send_message as call_llm

_SYSTEM_PROMPT_HEADER = (
    "You are Learned Friend, an internal AI assistant for a company's legal/procurement team, "
    "helping staff draft, negotiate, and review the organization's own contracts (supplier "
    "agreements, vendor deals, NDAs, partnership agreements). You are not a substitute for a "
    "qualified lawyer's sign-off — remind staff to confirm anything material before it's finalized. "
    "Ground your answers in the org's own pre-approved fallback clauses listed below when they're "
    "relevant, and say so when you cite one. If none of the listed clauses are relevant, answer from "
    "general knowledge and say the org has no pre-approved position on that topic yet."
)

_TITLE_MAX_LENGTH = 80


class AiAssistantService:

    def __init__(self, db: Session):
        self.db = db
        self.repository = AiAssistantRepository(db)
        self.fallback_clauses = FallbackClauseRepository(db)

    def list_conversations(self, user_id) -> list[AiConversation]:
        return self.repository.list_conversations_by_user(user_id)

    def get_conversation(self, conversation_id, user_id) -> tuple[AiConversation, list[AiMessage]]:
        conversation = self._get_owned_conversation(conversation_id, user_id)
        return conversation, self.repository.list_messages(conversation.id)

    def send_message(self, org_id, user_id, conversation_id, content: str) -> tuple[AiConversation, list[AiMessage]]:
        if conversation_id is None:
            conversation = self.repository.create_conversation(
                AiConversation(
                    org_id=org_id,
                    user_id=user_id,
                    title=content[:_TITLE_MAX_LENGTH],
                )
            )
        else:
            conversation = self._get_owned_conversation(conversation_id, user_id)

        history = self.repository.list_messages(conversation.id)

        user_message = self.repository.add_message(
            AiMessage(conversation_id=conversation.id, org_id=org_id, role="user", content=content)
        )
        history = [*history, user_message]

        system_prompt = self._build_system_prompt(org_id)
        reply_text = call_llm(
            system_prompt,
            [{"role": message.role, "content": message.content} for message in history],
        )

        assistant_message = self.repository.add_message(
            AiMessage(conversation_id=conversation.id, org_id=org_id, role="assistant", content=reply_text)
        )

        self.db.commit()
        return conversation, [*history, assistant_message]

    def _get_owned_conversation(self, conversation_id, user_id) -> AiConversation:
        conversation = self.repository.get_conversation_by_id(conversation_id)
        if not conversation or str(conversation.user_id) != str(user_id):
            raise ConversationNotFound()
        return conversation

    def _build_system_prompt(self, org_id) -> str:
        clauses = [clause for clause in self.fallback_clauses.list_by_org(org_id) if clause.pre_approved]
        if not clauses:
            return _SYSTEM_PROMPT_HEADER

        clause_lines = "\n\n".join(
            f"- {clause.name} ({clause.category}): {clause.description}\n  Clause text: {clause.content}"
            for clause in clauses
        )
        return f"{_SYSTEM_PROMPT_HEADER}\n\nThe org's pre-approved fallback clauses:\n\n{clause_lines}"
