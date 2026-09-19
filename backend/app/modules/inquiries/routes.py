from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.limiter import limiter
from app.database.session import get_db
from app.modules.inquiries.models import InquiryKind, InquiryStatus
from app.modules.inquiries.schemas import (
    CreateInquiryRequest,
    CreateInquiryResponse,
    InquiryListResponse,
    InquiryResponse,
    InquirySummaryResponse,
    UpdateInquiryRequest,
)
from app.modules.inquiries.service import InquiryService
from app.modules.owner.dependencies import get_current_owner

router = APIRouter(prefix="/inquiries", tags=["inquiries"])
owner_inquiries_router = APIRouter(prefix="/owner/inquiries", tags=["owner-inquiries"])


@router.post("", response_model=CreateInquiryResponse, status_code=201)
@limiter.limit("5/hour")
def submit_inquiry(request: Request, body: CreateInquiryRequest, db: Session = Depends(get_db)):
    InquiryService(db).submit(body)
    return CreateInquiryResponse(message="Thanks. We have your message and will reply soon.")


@owner_inquiries_router.get("", response_model=InquiryListResponse)
def list_inquiries(
    status: InquiryStatus | None = Query(default=None),
    kind: InquiryKind | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _owner=Depends(get_current_owner),
):
    items, total = InquiryService(db).list(status, kind, limit, offset)
    return InquiryListResponse(items=items, total=total)


@owner_inquiries_router.get("/summary", response_model=InquirySummaryResponse)
def inquiries_summary(db: Session = Depends(get_db), _owner=Depends(get_current_owner)):
    return InquiryService(db).summary()


@owner_inquiries_router.patch("/{inquiry_id}", response_model=InquiryResponse)
def update_inquiry(
    inquiry_id: str,
    body: UpdateInquiryRequest,
    db: Session = Depends(get_db),
    _owner=Depends(get_current_owner),
):
    return InquiryService(db).update(inquiry_id, body)


@owner_inquiries_router.delete("/{inquiry_id}", status_code=204)
def delete_inquiry(inquiry_id: str, db: Session = Depends(get_db), _owner=Depends(get_current_owner)):
    InquiryService(db).delete(inquiry_id)
