from sqlalchemy.orm import Session

from app.modules.notifications.repository import NotificationRepository
from app.modules.notifications.models import Notification, RecipientType
from app.exceptions.notifications import NotificationNotFound


class NotificationService:

    def __init__(self, db: Session):
        self.db = db
        self.repository = NotificationRepository(db)

    def notify(
        self,
        recipient_type: RecipientType,
        recipient_id,
        type: str,
        title: str,
        body: str,
        target_type: str | None = None,
        target_id=None,
    ) -> Notification:
        notification = Notification(
            recipient_type=recipient_type,
            recipient_id=recipient_id,
            type=type,
            title=title,
            body=body,
            target_type=target_type,
            target_id=target_id,
        )
        return self.repository.create(notification)

    def list_for_recipient(
        self, recipient_type: RecipientType, recipient_id, unread_only: bool, limit: int, offset: int
    ) -> list[Notification]:
        return self.repository.list_for_recipient(recipient_type, recipient_id, unread_only, limit, offset)

    def count_unread(self, recipient_type: RecipientType, recipient_id) -> int:
        return self.repository.count_unread(recipient_type, recipient_id)

    def mark_read(self, notification_id, recipient_type: RecipientType, recipient_id) -> Notification:
        notification = self.repository.get_by_id(notification_id)
        if (
            not notification
            or notification.recipient_type != recipient_type
            or str(notification.recipient_id) != str(recipient_id)
        ):
            raise NotificationNotFound()

        notification.is_read = True
        self.db.commit()
        return notification

    def mark_all_read(self, recipient_type: RecipientType, recipient_id):
        self.repository.mark_all_read(recipient_type, recipient_id)
        self.db.commit()
