from pydantic import BaseModel


class TopErrorPath(BaseModel):
    path: str
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
