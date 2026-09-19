from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.inquiries.models import Inquiry, InquiryKind, InquiryStatus


class InquiryRepository:
    def __init__(self, db: Session):
        self.db = db

    def create(self, inquiry: Inquiry) -> Inquiry:
        self.db.add(inquiry)
        self.db.flush()
        return inquiry

    def get_by_id(self, inquiry_id) -> Inquiry | None:
        return self.db.scalar(select(Inquiry).where(Inquiry.id == inquiry_id))

    def list(
        self,
        status: InquiryStatus | None,
        kind: InquiryKind | None,
        limit: int,
        offset: int,
    ) -> tuple[list[Inquiry], int]:
        filters = []
        if status:
            filters.append(Inquiry.status == status)
        if kind:
            filters.append(Inquiry.kind == kind)
        total = self.db.scalar(select(func.count()).select_from(Inquiry).where(*filters)) or 0
        rows = self.db.scalars(
            select(Inquiry)
            .where(*filters)
            .order_by(Inquiry.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(rows), total

    def counts_by_status(self) -> dict[InquiryStatus, int]:
        rows = self.db.execute(select(Inquiry.status, func.count()).group_by(Inquiry.status)).all()
        return {status: count for status, count in rows}

    def count_new_by_kind(self, kind: InquiryKind) -> int:
        return (
            self.db.scalar(
                select(func.count())
                .select_from(Inquiry)
                .where(Inquiry.status == InquiryStatus.NEW, Inquiry.kind == kind)
            )
            or 0
        )

    def delete(self, inquiry: Inquiry) -> None:
        self.db.delete(inquiry)
        self.db.flush()
