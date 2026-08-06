from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.announcements.models import Announcement


class AnnouncementRepository:

    def __init__(self, db: Session):
        self.db = db

    def create(self, announcement: Announcement) -> Announcement:
        self.db.add(announcement)
        self.db.flush()
        return announcement

    def get_by_id(self, announcement_id) -> Announcement | None:
        return self.db.scalar(select(Announcement).where(Announcement.id == announcement_id))

    def list_all(self) -> list[Announcement]:
        return list(self.db.scalars(select(Announcement).order_by(Announcement.created_at.desc())))

    def list_active(self) -> list[Announcement]:
        statement = (
            select(Announcement)
            .where(Announcement.is_active.is_(True))
            .order_by(Announcement.created_at.desc())
        )
        return list(self.db.scalars(statement))

    def delete(self, announcement: Announcement):
        self.db.delete(announcement)
        self.db.flush()
