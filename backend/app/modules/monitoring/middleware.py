import time

from fastapi import Request

from app.database.session import SessionLocal
from app.modules.monitoring.models import RequestLog
from app.modules.monitoring.repository import RequestLogRepository


async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    status_code = 500
    try:
        response = await call_next(request)
        status_code = response.status_code
        return response
    finally:
        duration_ms = int((time.perf_counter() - start) * 1000)
        # Path template (e.g. "/matters/{matter_id}") rather than the raw URL, so
        # aggregates group by endpoint instead of fragmenting per resource id.
        # request.scope["route"] is only populated once routing has resolved,
        # which happens inside call_next — so it's read here, after the await.
        route = request.scope.get("route")
        path = route.path if route else request.url.path

        db = SessionLocal()
        try:
            RequestLogRepository(db).create(RequestLog(
                method=request.method,
                path=path,
                status_code=status_code,
                duration_ms=duration_ms,
            ))
        except Exception:
            db.rollback()
        finally:
            db.close()
