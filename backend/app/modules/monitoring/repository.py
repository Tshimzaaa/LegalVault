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

    def p95_duration_ms(self, since: datetime) -> float | None:
        return self.db.scalar(
            select(func.percentile_cont(0.95).within_group(RequestLog.duration_ms))
            .where(RequestLog.created_at >= since)
        )

    def path_stats(self, since: datetime) -> list[tuple[str, str, int, float | None, int]]:
        """Per (method, path) request count, average duration, and error count in the window."""
        error_count = func.sum(case((RequestLog.status_code >= 400, 1), else_=0))
        statement = (
            select(
                RequestLog.method,
                RequestLog.path,
                func.count(),
                func.avg(RequestLog.duration_ms),
                error_count,
            )
            .where(RequestLog.created_at >= since)
            .group_by(RequestLog.method, RequestLog.path)
        )
        return list(self.db.execute(statement).all())

    def requests_per_hour(self, since: datetime) -> list[tuple[datetime, int, float | None]]:
        bucket = func.date_trunc("hour", RequestLog.created_at)
        statement = (
            select(bucket, func.count(), func.avg(RequestLog.duration_ms))
            .where(RequestLog.created_at >= since)
            .group_by(bucket)
            .order_by(bucket)
        )
        return list(self.db.execute(statement).all())

    def distinct_actors(self, since: datetime) -> list[tuple[str, str]]:
        statement = (
            select(RequestLog.actor_type, RequestLog.actor_id)
            .where(
                RequestLog.created_at >= since,
                RequestLog.actor_type.in_(["staff", "client"]),
                RequestLog.actor_id.is_not(None),
            )
            .distinct()
        )
        return list(self.db.execute(statement).all())

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
