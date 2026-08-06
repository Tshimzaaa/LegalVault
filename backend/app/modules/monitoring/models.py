from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import BaseModel


class RequestLog(BaseModel):
    __tablename__ = "request_logs"

    method: Mapped[str] = mapped_column(String(10), nullable=False)

    path: Mapped[str] = mapped_column(String(500), nullable=False, index=True)

    status_code: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False)

    # Best-effort identity of the caller, decoded from the bearer token — "staff" | "client" | "owner" | None (anonymous).
    actor_type: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Raw subject claim from the token: a user/contact UUID as a string, or "owner". None when anonymous.
    actor_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # The response's "detail" message for handled 4xx/5xx, or "ExceptionType: message" for an unhandled crash.
    error_detail: Mapped[str | None] = mapped_column(Text, nullable=True)
