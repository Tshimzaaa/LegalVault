from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

engine = create_engine(
    settings.RUNTIME_DATABASE_URL or settings.DATABASE_URL,
    echo=False,
    pool_pre_ping=True,  # tests connections before using them, reconnects if stale
)

SessionLocal = sessionmaker(
    autoflush=False,
    autocommit=False,
    bind=engine
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_session():
    """Non-FastAPI equivalent of get_db() for code with no request lifecycle to hook
    commit/rollback into (Celery tasks, one-off scripts). Commits on clean exit, rolls
    back and re-raises on any exception, always closes. Callers should not call
    db.commit() themselves."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()