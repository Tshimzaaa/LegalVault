from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.clients.dependencies import get_current_contact
from app.modules.clients.models import ClientContact
from app.modules.notifications.models import RecipientType
from app.modules.notifications.schemas import NotificationResponse, UnreadCountResponse
from app.modules.notifications.service import NotificationService

router = APIRouter(prefix="/notifications", tags=["notifications"])
client_notifications_router = APIRouter(prefix="/client-notifications", tags=["client-notifications"])


@router.get("", response_model=list[NotificationResponse])
def list_notifications(
    unread_only: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = NotificationService(db)
    return service.list_for_recipient(RecipientType.STAFF, current_user.id, unread_only, limit, offset)


@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = NotificationService(db)
    return UnreadCountResponse(unread_count=service.count_unread(RecipientType.STAFF, current_user.id))


@router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = NotificationService(db)
    return service.mark_read(notification_id, RecipientType.STAFF, current_user.id)


@router.post("/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = NotificationService(db)
    service.mark_all_read(RecipientType.STAFF, current_user.id)
    return {"message": "All notifications marked as read."}


@client_notifications_router.get("", response_model=list[NotificationResponse])
def list_client_notifications(
    unread_only: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_contact: ClientContact = Depends(get_current_contact),
):
    service = NotificationService(db)
    return service.list_for_recipient(RecipientType.CLIENT_CONTACT, current_contact.id, unread_only, limit, offset)


@client_notifications_router.get("/unread-count", response_model=UnreadCountResponse)
def get_client_unread_count(
    db: Session = Depends(get_db),
    current_contact: ClientContact = Depends(get_current_contact),
):
    service = NotificationService(db)
    return UnreadCountResponse(unread_count=service.count_unread(RecipientType.CLIENT_CONTACT, current_contact.id))


@client_notifications_router.patch("/{notification_id}/read", response_model=NotificationResponse)
def mark_client_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_contact: ClientContact = Depends(get_current_contact),
):
    service = NotificationService(db)
    return service.mark_read(notification_id, RecipientType.CLIENT_CONTACT, current_contact.id)


@client_notifications_router.post("/read-all")
def mark_all_client_notifications_read(
    db: Session = Depends(get_db),
    current_contact: ClientContact = Depends(get_current_contact),
):
    service = NotificationService(db)
    service.mark_all_read(RecipientType.CLIENT_CONTACT, current_contact.id)
    return {"message": "All notifications marked as read."}
