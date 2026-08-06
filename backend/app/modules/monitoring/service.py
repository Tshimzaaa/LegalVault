from datetime import datetime, timedelta, UTC
from sqlalchemy.orm import Session

from app.modules.auth.repository import AuthRepository
from app.modules.clients.repository import ClientRepository
from app.modules.monitoring.repository import RequestLogRepository
from app.modules.monitoring.schemas import RequestErrorEntry, RequestMetrics, TopErrorPath


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
                TopErrorPath(path=path, status_code=status_code, count=count)
                for path, status_code, count in self.repository.top_error_paths(since)
            ],
        )

    def list_recent_errors(self, window_hours: int, limit: int, offset: int) -> list[RequestErrorEntry]:
        since = datetime.now(UTC) - timedelta(hours=window_hours)
        rows = self.repository.list_errors(since, limit, offset)

        auth_repo = AuthRepository(self.db)
        client_repo = ClientRepository(self.db)
        label_cache: dict[tuple[str, str], str | None] = {}

        def resolve_label(actor_type: str | None, actor_id: str | None) -> str | None:
            if actor_type == "owner":
                return "Owner"
            if actor_type not in ("staff", "client") or not actor_id:
                return None
            key = (actor_type, actor_id)
            if key not in label_cache:
                if actor_type == "staff":
                    user = auth_repo.get_user_by_id(actor_id)
                    label_cache[key] = user.email if user else None
                else:
                    contact = client_repo.get_contact_by_id(actor_id)
                    label_cache[key] = contact.email if contact else None
            return label_cache[key]

        return [
            RequestErrorEntry(
                id=row.id,
                created_at=row.created_at,
                method=row.method,
                path=row.path,
                status_code=row.status_code,
                duration_ms=row.duration_ms,
                error_detail=row.error_detail,
                actor_type=row.actor_type,
                actor_id=row.actor_id,
                actor_label=resolve_label(row.actor_type, row.actor_id),
            )
            for row in rows
        ]
