from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.modules.notifications.models import Notification, RecipientType


class NotificationRepository:

    def __init__(self, db: Session):
        self.db = db

    def create(self, notification: Notification) -> Notification:
        self.db.add(notification)
        self.db.flush()
        return notification

    def create_many(self, notifications: list[Notification]) -> list[Notification]:
        """Insert every notification in one round trip instead of one flush per row."""
        if not notifications:
            return []
        self.db.add_all(notifications)
        self.db.flush()
        return notifications

    def get_by_id(self, notification_id) -> Notification | None:
        return self.db.scalar(select(Notification).where(Notification.id == notification_id))

    def list_for_recipient(
        self, recipient_type: RecipientType, recipient_id, unread_only: bool, limit: int, offset: int
    ) -> list[Notification]:
        statement = select(Notification).where(
            Notification.recipient_type == recipient_type,
            Notification.recipient_id == recipient_id,
        )
        if unread_only:
            statement = statement.where(Notification.is_read.is_(False))
        statement = statement.order_by(Notification.created_at.desc()).limit(limit).offset(offset)
        return list(self.db.scalars(statement))

    def count_unread(self, recipient_type: RecipientType, recipient_id) -> int:
        return self.db.scalar(
            select(func.count())
            .select_from(Notification)
            .where(
                Notification.recipient_type == recipient_type,
                Notification.recipient_id == recipient_id,
                Notification.is_read.is_(False),
            )
        )

    def mark_all_read(self, recipient_type: RecipientType, recipient_id):
        self.db.execute(
            update(Notification)
            .where(
                Notification.recipient_type == recipient_type,
                Notification.recipient_id == recipient_id,
                Notification.is_read.is_(False),
            )
            .values(is_read=True)
        )

    def delete_for_recipient(self, recipient_type: RecipientType, recipient_id):
        statement = select(Notification).where(
            Notification.recipient_type == recipient_type,
            Notification.recipient_id == recipient_id,
        )
        for notification in list(self.db.scalars(statement)):
            self.db.delete(notification)
