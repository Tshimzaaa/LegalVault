import json
import time

from fastapi import Request
from starlette.background import BackgroundTask
from starlette.responses import Response

from app.core.security import decode_access_token
from app.database.session import SessionLocal
from app.modules.monitoring.models import RequestLog
from app.modules.monitoring.repository import RequestLogRepository

MAX_ERROR_DETAIL_LENGTH = 2000


def _decode_actor(request: Request) -> tuple[str | None, str | None]:
    """Best-effort actor identity from the bearer token — no DB call, just JWT decode."""
    auth = request.headers.get("authorization")
    if not auth or not auth.lower().startswith("bearer "):
        return None, None

    payload = decode_access_token(auth[7:])
    if not payload:
        return None, None

    token_type = payload.get("type")
    if token_type == "owner":
        return "owner", "owner"
    if token_type == "client":
        return ("client", payload["sub"]) if "sub" in payload else (None, None)
    if "sub" in payload:
        return "staff", payload["sub"]
    return None, None


async def _consume_error_body(response: Response) -> tuple[Response, str | None]:
    """Buffer an error response to pull its `detail` message, then rebuild it unchanged for the client."""
    body = b""
    async for chunk in response.body_iterator:
        body += chunk

    detail = None
    try:
        parsed = json.loads(body)
        if isinstance(parsed, dict) and "detail" in parsed:
            detail = str(parsed["detail"])
    except (json.JSONDecodeError, UnicodeDecodeError):
        pass
    if detail is None and body:
        detail = body.decode("utf-8", errors="replace")
    if detail is not None:
        detail = detail[:MAX_ERROR_DETAIL_LENGTH]

    headers = {k: v for k, v in response.headers.items() if k.lower() != "content-length"}
    rebuilt = Response(content=body, status_code=response.status_code, headers=headers, media_type=response.media_type)
    return rebuilt, detail


def _write_log(log: RequestLog) -> None:
    db = SessionLocal()
    try:
        RequestLogRepository(db).create(log)
    except Exception:
        db.rollback()
    finally:
        db.close()


async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    status_code = 500
    error_detail: str | None = None
    actor_type, actor_id = _decode_actor(request)
    response: Response | None = None

    try:
        response = await call_next(request)
        status_code = response.status_code
        if status_code >= 400:
            response, error_detail = await _consume_error_body(response)
        return response
    except Exception as exc:
        # Nothing downstream converted this into a response — it's an unhandled crash.
        # Capture what it was before re-raising so ServerErrorMiddleware can still return its generic 500.
        error_detail = f"{type(exc).__name__}: {exc}"[:MAX_ERROR_DETAIL_LENGTH]
        raise
    finally:
        duration_ms = int((time.perf_counter() - start) * 1000)
        # Path template (e.g. "/matters/{matter_id}") rather than the raw URL, so
        # aggregates group by endpoint instead of fragmenting per resource id.
        # request.scope["route"] is only populated once routing has resolved,
        # which happens inside call_next — so it's read here, after the await.
        route = request.scope.get("route")
        path = route.path if route else request.url.path

        log = RequestLog(
            method=request.method,
            path=path,
            status_code=status_code,
            duration_ms=duration_ms,
            actor_type=actor_type,
            actor_id=actor_id,
            error_detail=error_detail,
        )
        if response is not None:
            # Defer the write until after the response bytes are on the wire, so
            # logging never adds a DB round-trip to every request's latency.
            response.background = BackgroundTask(_write_log, log)
        else:
            # No response was produced (unhandled crash) — nothing to attach a
            # background task to, so write synchronously before re-raising.
            _write_log(log)
