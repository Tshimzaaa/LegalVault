from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.modules.ai_assistant.schemas import (
    ConversationSummaryResponse,
    ConversationDetailResponse,
    SendMessageRequest,
)
from app.modules.ai_assistant.service import AiAssistantService

from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User

router = APIRouter(prefix="/ai-assistant", tags=["ai-assistant"])


@router.get("/conversations", response_model=list[ConversationSummaryResponse])
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = AiAssistantService(db)
    return service.list_conversations(current_user.id)


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse)
def get_conversation(
    conversation_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = AiAssistantService(db)
    conversation, messages = service.get_conversation(conversation_id, current_user.id)
    return ConversationDetailResponse(
        id=conversation.id, title=conversation.title, created_at=conversation.created_at, messages=messages
    )


@router.post("/messages", response_model=ConversationDetailResponse)
def send_message(
    request: SendMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = AiAssistantService(db)
    conversation, messages = service.send_message(
        current_user.org_id, current_user.id, request.conversation_id, request.content
    )
    return ConversationDetailResponse(
        id=conversation.id, title=conversation.title, created_at=conversation.created_at, messages=messages
    )
