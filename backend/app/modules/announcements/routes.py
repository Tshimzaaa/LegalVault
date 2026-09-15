from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.owner.dependencies import get_current_owner
from app.modules.announcements.schemas import (
    CreateAnnouncementRequest,
    UpdateAnnouncementRequest,
    AnnouncementResponse,
)
from app.modules.announcements.service import AnnouncementService

router = APIRouter(prefix="/announcements", tags=["announcements"])
owner_announcements_router = APIRouter(prefix="/owner/announcements", tags=["owner-announcements"])


@owner_announcements_router.post("", response_model=AnnouncementResponse, status_code=201)
def create_announcement(
    request: CreateAnnouncementRequest,
    db: Session = Depends(get_db),
    _owner=Depends(get_current_owner),
):
    service = AnnouncementService(db)
    return service.create(request)


@owner_announcements_router.get("", response_model=list[AnnouncementResponse])
def list_all_announcements(db: Session = Depends(get_db), _owner=Depends(get_current_owner)):
    service = AnnouncementService(db)
    return service.list_all()


@owner_announcements_router.patch("/{announcement_id}", response_model=AnnouncementResponse)
def update_announcement(
    announcement_id: str,
    request: UpdateAnnouncementRequest,
    db: Session = Depends(get_db),
    _owner=Depends(get_current_owner),
):
    service = AnnouncementService(db)
    return service.update(announcement_id, request)


@owner_announcements_router.delete("/{announcement_id}", status_code=204)
def delete_announcement(
    announcement_id: str,
    db: Session = Depends(get_db),
    _owner=Depends(get_current_owner),
):
    service = AnnouncementService(db)
    service.delete(announcement_id)


@router.get("", response_model=list[AnnouncementResponse])
def list_announcements_for_staff(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = AnnouncementService(db)
    return service.list_active()
