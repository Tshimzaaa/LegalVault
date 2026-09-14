from sqlalchemy.orm import Session

from app.modules.announcements.repository import AnnouncementRepository
from app.modules.announcements.models import Announcement
from app.modules.announcements.schemas import CreateAnnouncementRequest, UpdateAnnouncementRequest
from app.exceptions.announcements import AnnouncementNotFound
from app.modules.audit.service import AuditService
from app.modules.audit.models import ActorType
from app.modules.audit import actions as audit_actions


class AnnouncementService:

    def __init__(self, db: Session):
        self.db = db
        self.repository = AnnouncementRepository(db)
        self.audit = AuditService(db)

    def create(self, request: CreateAnnouncementRequest) -> Announcement:
        announcement = Announcement(
            title=request.title,
            body=request.body,
            severity=request.severity,
            is_active=request.is_active,
        )
        self.repository.create(announcement)

        self.audit.log(
            actor_type=ActorType.OWNER,
            actor_id=None,
            org_id=None,
            action=audit_actions.ANNOUNCEMENT_CREATED,
            target_type="announcement",
            target_id=announcement.id,
            details={"title": announcement.title, "severity": announcement.severity.value},
        )
        self.db.commit()
        return announcement

    def list_all(self) -> list[Announcement]:
        return self.repository.list_all()

    def list_active(self) -> list[Announcement]:
        return self.repository.list_active()

    def update(self, announcement_id, request: UpdateAnnouncementRequest) -> Announcement:
        announcement = self.repository.get_by_id(announcement_id)
        if not announcement:
            raise AnnouncementNotFound()

        updates = request.model_dump(exclude_unset=True)
        for field, value in updates.items():
            setattr(announcement, field, value)

        self.audit.log(
            actor_type=ActorType.OWNER,
            actor_id=None,
            org_id=None,
            action=audit_actions.ANNOUNCEMENT_UPDATED,
            target_type="announcement",
            target_id=announcement.id,
            details={k: (v.value if hasattr(v, "value") else v) for k, v in updates.items()},
        )
        self.db.commit()
        return announcement

    def delete(self, announcement_id):
        announcement = self.repository.get_by_id(announcement_id)
        if not announcement:
            raise AnnouncementNotFound()

        self.repository.delete(announcement)

        self.audit.log(
            actor_type=ActorType.OWNER,
            actor_id=None,
            org_id=None,
            action=audit_actions.ANNOUNCEMENT_DELETED,
            target_type="announcement",
            target_id=announcement.id,
            details={"title": announcement.title},
        )
        self.db.commit()
