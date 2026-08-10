from datetime import datetime, timedelta, UTC
from sqlalchemy.orm import Session

from app.modules.auth.repository import AuthRepository
from app.modules.clients.repository import ClientRepository
from app.modules.monitoring.repository import RequestLogRepository
from app.modules.monitoring.schemas import (
    RequestErrorEntry,
    RequestMetrics,
    TopErrorPath,
    ServiceHealthEntry,
    EndpointStat,
    RequestTimeseriesPoint,
)

# Maps a route's first path segment to a human-friendly service name for the System Health
# panel. Segments not listed here (and the "client-" prefix) fall back to a title-cased guess.
SERVICE_LABELS = {
    "auth": "Authentication",
    "client-auth": "Authentication",
    "owner": "Owner / Admin",
    "matters": "Matters",
    "client-matters": "Matters",
    "clients": "Clients",
    "templates": "Templates",
    "client-templates": "Templates",
    "support-requests": "Support Requests",
    "client-support-requests": "Support Requests",
    "search": "Search",
    "audit": "Audit Log",
    "announcements": "Announcements",
    "owner-announcements": "Announcements",
    "client-announcements": "Announcements",
    "notifications": "Notifications",
    "client-notifications": "Notifications",
    "reporting": "Reporting",
    "client-reporting": "Reporting",
    "signed-contracts": "Signed Contracts",
    "client-signed-contracts": "Signed Contracts",
    "dashboard": "Dashboard",
    "client-dashboard": "Dashboard",
}

# A service is flagged "degraded" once its error rate or average latency crosses these —
# thresholds are illustrative, not tuned against real production traffic.
SERVICE_ERROR_RATE_THRESHOLD = 5.0
SERVICE_LATENCY_THRESHOLD_MS = 1000.0


def _service_label(path: str) -> str:
    if "/documents" in path:
        return "Documents"
    segments = [p for p in path.split("/") if p]
    if not segments:
        return "Other"
    return SERVICE_LABELS.get(segments[0], segments[0].replace("-", " ").title())


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
            p95_duration_ms=self.repository.p95_duration_ms(since),
            top_error_paths=[
                TopErrorPath(path=path, status_code=status_code, count=count)
                for path, status_code, count in self.repository.top_error_paths(since)
            ],
        )

    def get_service_health(self, window_hours: int, limit: int = 6) -> list[ServiceHealthEntry]:
        since = datetime.now(UTC) - timedelta(hours=window_hours)
        rows = self.repository.path_stats(since)

        buckets: dict[str, dict] = {}
        for _method, path, count, avg_duration, errors in rows:
            bucket = buckets.setdefault(_service_label(path), {"count": 0, "duration_total": 0.0, "errors": 0})
            bucket["count"] += count
            # avg_duration comes back as a Decimal from Postgres' AVG() over an integer column.
            bucket["duration_total"] += float(avg_duration or 0) * count
            bucket["errors"] += errors

        entries = []
        for name, bucket in buckets.items():
            avg_duration_ms = (bucket["duration_total"] / bucket["count"]) if bucket["count"] else None
            error_rate = (bucket["errors"] / bucket["count"] * 100) if bucket["count"] else 0.0
            degraded = error_rate > SERVICE_ERROR_RATE_THRESHOLD or (avg_duration_ms or 0) > SERVICE_LATENCY_THRESHOLD_MS
            entries.append(ServiceHealthEntry(
                name=name,
                status="degraded" if degraded else "healthy",
                request_count=bucket["count"],
                error_rate_percent=round(error_rate, 2),
                avg_duration_ms=round(avg_duration_ms, 1) if avg_duration_ms is not None else None,
            ))

        entries.sort(key=lambda e: e.request_count, reverse=True)
        return entries[:limit]

    def get_worst_endpoints(self, window_hours: int, limit: int = 5) -> list[EndpointStat]:
        since = datetime.now(UTC) - timedelta(hours=window_hours)
        rows = self.repository.path_stats(since)

        entries = [
            EndpointStat(
                method=method,
                path=path,
                request_count=count,
                error_count=errors,
                error_rate_percent=round((errors / count * 100), 2) if count else 0.0,
            )
            for method, path, count, _avg_duration, errors in rows
            if errors > 0
        ]
        entries.sort(key=lambda e: (e.error_rate_percent, e.error_count), reverse=True)
        return entries[:limit]

    def get_request_timeseries(self, window_hours: int) -> list[RequestTimeseriesPoint]:
        since = datetime.now(UTC) - timedelta(hours=window_hours)
        rows = self.repository.requests_per_hour(since)
        return [
            RequestTimeseriesPoint(
                bucket=bucket,
                request_count=count,
                average_duration_ms=round(avg_duration, 1) if avg_duration is not None else None,
            )
            for bucket, count, avg_duration in rows
        ]

    def get_active_usage(self, window_hours: int) -> tuple[int, int]:
        """Distinct signed-in actors, and distinct firms they belong to, in the window."""
        since = datetime.now(UTC) - timedelta(hours=window_hours)
        actors = self.repository.distinct_actors(since)

        staff_ids = [actor_id for actor_type, actor_id in actors if actor_type == "staff"]
        client_contact_ids = [actor_id for actor_type, actor_id in actors if actor_type == "client"]

        auth_repo = AuthRepository(self.db)
        client_repo = ClientRepository(self.db)

        firm_ids = {u.firm_id for u in auth_repo.list_users_by_ids(staff_ids)}

        contacts = client_repo.list_contacts_by_ids(client_contact_ids)
        clients = client_repo.list_clients_by_ids({c.client_id for c in contacts})
        firm_ids |= {c.firm_id for c in clients}

        return len(actors), len(firm_ids)

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
