from datetime import datetime

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.modules.monitoring.models import RequestLog


class RequestLogRepository:

    def __init__(self, db: Session):
        self.db = db

    def create(self, entry: RequestLog) -> RequestLog:
        self.db.add(entry)
        self.db.commit()
        return entry

    def count_total(self, since: datetime) -> int:
        return self.db.scalar(
            select(func.count()).select_from(RequestLog).where(RequestLog.created_at >= since)
        )

    def count_by_status_class(self, since: datetime) -> dict[str, int]:
        bucket = case(
            (RequestLog.status_code < 300, "2xx"),
            (RequestLog.status_code < 400, "3xx"),
            (RequestLog.status_code < 500, "4xx"),
            else_="5xx",
        ).label("bucket")

        statement = (
            select(bucket, func.count())
            .where(RequestLog.created_at >= since)
            .group_by(bucket)
        )
        return {row[0]: row[1] for row in self.db.execute(statement).all()}

    def average_duration_ms(self, since: datetime) -> float | None:
        return self.db.scalar(
            select(func.avg(RequestLog.duration_ms)).where(RequestLog.created_at >= since)
        )

    def top_error_paths(self, since: datetime, limit: int = 10) -> list[tuple[str, int, int]]:
        statement = (
            select(RequestLog.path, RequestLog.status_code, func.count())
            .where(RequestLog.created_at >= since, RequestLog.status_code >= 400)
            .group_by(RequestLog.path, RequestLog.status_code)
            .order_by(func.count().desc())
            .limit(limit)
        )
        return list(self.db.execute(statement).all())

    def list_errors(self, since: datetime, limit: int = 50, offset: int = 0) -> list[RequestLog]:
        statement = (
            select(RequestLog)
            .where(RequestLog.created_at >= since, RequestLog.status_code >= 400)
            .order_by(RequestLog.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return list(self.db.scalars(statement).all())
