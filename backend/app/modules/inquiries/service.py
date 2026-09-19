from datetime import datetime, UTC
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.modules.inquiries.models import Inquiry, InquiryKind, InquiryStatus
from app.modules.inquiries.repository import InquiryRepository
from app.modules.inquiries.schemas import (
    CreateInquiryRequest,
    InquirySummaryResponse,
    UpdateInquiryRequest,
)

CLOSED_STATES = (InquiryStatus.ONBOARDED, InquiryStatus.CLOSED)


class InquiryService:
    def __init__(self, db: Session):
        self.db = db
        self.repository = InquiryRepository(db)

    def submit(self, request: CreateInquiryRequest) -> None:
        if request.website:
            return
        self.repository.create(
            Inquiry(
                kind=request.kind,
                name=request.name.strip(),
                email=str(request.email).lower(),
                phone=(request.phone or "").strip() or None,
                organization_name=request.organization_name,
                message=request.message,
            )
        )
        self.db.commit()

    def list(self, status, kind, limit: int, offset: int):
        return self.repository.list(status, kind, limit, offset)

    def summary(self) -> InquirySummaryResponse:
        counts = self.repository.counts_by_status()
        return InquirySummaryResponse(
            new=counts.get(InquiryStatus.NEW, 0),
            in_progress=counts.get(InquiryStatus.IN_PROGRESS, 0),
            onboarded=counts.get(InquiryStatus.ONBOARDED, 0),
            closed=counts.get(InquiryStatus.CLOSED, 0),
            new_access_requests=self.repository.count_new_by_kind(InquiryKind.ACCESS_REQUEST),
            new_contact=self.repository.count_new_by_kind(InquiryKind.CONTACT),
        )

    def update(self, inquiry_id: str, request: UpdateInquiryRequest) -> Inquiry:
        inquiry = self._get(inquiry_id)
        fields = request.model_fields_set
        if "status" in fields and request.status is not None:
            inquiry.status = request.status
            inquiry.handled_at = datetime.now(UTC) if request.status in CLOSED_STATES else None
        if "owner_note" in fields:
            inquiry.owner_note = (request.owner_note or "").strip() or None
        if "organization_id" in fields:
            inquiry.organization_id = request.organization_id
        self.db.commit()
        self.db.refresh(inquiry)
        return inquiry

    def delete(self, inquiry_id: str) -> None:
        self.repository.delete(self._get(inquiry_id))
        self.db.commit()

    def _get(self, inquiry_id: str) -> Inquiry:
        try:
            parsed = UUID(inquiry_id)
        except ValueError:
            raise HTTPException(status_code=404, detail="Inquiry not found.")
        inquiry = self.repository.get_by_id(parsed)
        if not inquiry:
            raise HTTPException(status_code=404, detail="Inquiry not found.")
        return inquiry
