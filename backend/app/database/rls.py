from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


def set_tenant_context(db: Session, firm_id: UUID | str | None, is_owner: bool = False) -> None:
    """
    Sets the Postgres session-local GUCs the row-level-security policies
    (see the `add_row_level_security` migration) key off of.

    SET LOCAL is transaction-scoped, so this only takes effect for the
    transaction already open on `db` — call it on the same Session that will
    run the request's actual queries (i.e. from within an auth dependency
    that already has `db` injected), not on a throwaway connection.
    """
    db.execute(text("SET LOCAL app.is_owner = :is_owner"), {"is_owner": "true" if is_owner else "false"})
    db.execute(
        text("SET LOCAL app.current_firm_id = :firm_id"),
        {"firm_id": str(firm_id) if firm_id else ""},
    )
