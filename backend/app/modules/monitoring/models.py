from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import BaseModel


class RequestLog(BaseModel):
    __tablename__ = "request_logs"

    method: Mapped[str] = mapped_column(String(10), nullable=False)

    path: Mapped[str] = mapped_column(String(500), nullable=False, index=True)

    status_code: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    duration_ms: Mapped[int] = mapped_column(Integer, nullable=False)
