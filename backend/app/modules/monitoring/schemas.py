from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class TopErrorPath(BaseModel):
    path: str
    status_code: int
    count: int


class RequestMetrics(BaseModel):
    window_hours: int
    total_requests: int
    status_2xx: int
    status_3xx: int
    status_4xx: int
    status_5xx: int
    error_rate_percent: float
    average_duration_ms: float | None
    top_error_paths: list[TopErrorPath]


class RequestErrorEntry(BaseModel):
    id: UUID
    created_at: datetime
    method: str
    path: str
    status_code: int
    duration_ms: int
    error_detail: str | None
    actor_type: str | None
    actor_id: str | None
    # Resolved from actor_type/actor_id at read time (email for staff/client, "Owner", or None if anonymous).
    actor_label: str | None
