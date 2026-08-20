from uuid import UUID

from sqlalchemy import event, text
from sqlalchemy.orm import Session


def set_tenant_context(db: Session, firm_id: UUID | str | None, is_owner: bool = False) -> None:
    """
    Sets the Postgres session-local GUCs the row-level-security policies
    (see the `add_row_level_security` migration) key off of.

    SET LOCAL is transaction-scoped, so this only takes effect for the
    transaction already open on `db` — call it on the same Session that will
    run the request's actual queries (i.e. from within an auth dependency
    that already has `db` injected), not on a throwaway connection.

    Also stashes the values on the Session's `.info` dict so the `after_begin`
    listener below can re-issue them automatically every time a *new* Postgres
    transaction starts on this same session. That's necessary because a real
    `db.commit()` ends the transaction SET LOCAL was scoped to, and SQLAlchemy's
    default `expire_on_commit=True` means the very next attribute access on any
    ORM object (e.g. FastAPI serializing the response right after a service
    method commits and returns the object it just created) transparently opens
    a fresh transaction to re-SELECT it. Without this listener, that re-SELECT
    would run with no tenant context, RLS would hide the row the request just
    wrote, and SQLAlchemy would raise `ObjectDeletedError` — indistinguishable
    from a real concurrent deletion, even though nothing was ever deleted.
    """
    db.info["tenant_is_owner"] = "true" if is_owner else "false"
    db.info["tenant_firm_id"] = str(firm_id) if firm_id else ""
    _apply_tenant_context(db, db.info)


def _apply_tenant_context(executable, info: dict) -> None:
    executable.execute(text("SET LOCAL app.is_owner = :is_owner"), {"is_owner": info["tenant_is_owner"]})
    executable.execute(text("SET LOCAL app.current_firm_id = :firm_id"), {"firm_id": info["tenant_firm_id"]})


@event.listens_for(Session, "after_begin")
def _reapply_tenant_context_on_new_transaction(session, transaction, connection) -> None:
    if "tenant_firm_id" in session.info:
        _apply_tenant_context(connection, session.info)
