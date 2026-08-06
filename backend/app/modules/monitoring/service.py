from datetime import datetime, timedelta, UTC
from sqlalchemy.orm import Session

from app.modules.monitoring.repository import RequestLogRepository
from app.modules.monitoring.schemas import RequestMetrics, TopErrorPath


class MonitoringService:

    def __init__(self, db: Session):
        self.db = db
        self.repository = RequestLogRepository(db)

    def get_request_metrics(self, window_hours: int) -> RequestMetrics:
        since = datetime.now(UTC) - timedelta(hours=window_hours)

        total = self.repository.count_total(since) or 0
        by_status = self.repository.count_by_status_class(since)
        errors = by_status.get("4xx", 0) + by_status.get("5xx", 0)

        return RequestMetrics(
            window_hours=window_hours,
            total_requests=total,
            status_2xx=by_status.get("2xx", 0),
            status_3xx=by_status.get("3xx", 0),
            status_4xx=by_status.get("4xx", 0),
            status_5xx=by_status.get("5xx", 0),
            error_rate_percent=round((errors / total * 100), 2) if total else 0.0,
            average_duration_ms=self.repository.average_duration_ms(since),
            top_error_paths=[
                TopErrorPath(path=path, count=count)
                for path, count in self.repository.top_error_paths(since)
            ],
        )
