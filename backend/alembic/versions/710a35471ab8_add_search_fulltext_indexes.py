"""add search full-text indexes

Expression GIN indexes backing the upgrade from ILIKE substring search to real Postgres
full-text search (see app/modules/search/service.py). No new column, no ORM model
changes — each index's expression must match the query-time expression in
SearchService.search() verbatim for Postgres to use it for the `@@` operator.

to_tsvector(regconfig, text) is declared STABLE, not IMMUTABLE, in Postgres's own
catalog (even with a literal config name) — so it can't be used directly in an index
expression ("functions in index expression must be marked IMMUTABLE"). The fix is a
thin wrapper function that pins the config and is marked IMMUTABLE; both the index and
the query (via func.immutable_english_tsvector(...)) call this wrapper instead of
to_tsvector directly. The wrapper must be LANGUAGE plpgsql, not LANGUAGE sql — a
single-statement SQL function gets inlined by the planner, which re-exposes the inner
STABLE to_tsvector call and fails the same IMMUTABLE check anyway; plpgsql functions
aren't inlined, so the outer IMMUTABLE declaration is trusted as-is.

Second gotcha, same root cause: concat_ws() is *also* STABLE in Postgres's catalog
(not just to_tsvector), so the multi-column expressions build the joined string with
coalesce(...) || ' ' || coalesce(...) instead — coalesce and || (textcat) are both
genuinely IMMUTABLE, unlike concat_ws.

Revision ID: 710a35471ab8
Revises: 3017f4278009
Create Date: 2026-08-25 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '710a35471ab8'
down_revision: Union[str, Sequence[str], None] = '3017f4278009'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def _joined(*columns: str) -> str:
    return " || ' ' || ".join(f"coalesce({c}, '')" for c in columns)


_INDEXES = {
    "ix_clients_search_vector": (
        "clients",
        f"immutable_english_tsvector({_joined('company_name')})",
    ),
    "ix_client_contacts_search_vector": (
        "client_contacts",
        f"immutable_english_tsvector({_joined('first_name', 'last_name', 'email')})",
    ),
    "ix_matters_search_vector": (
        "matters",
        f"immutable_english_tsvector({_joined('title', 'description')})",
    ),
    "ix_users_search_vector": (
        "users",
        f"immutable_english_tsvector({_joined('first_name', 'last_name', 'email')})",
    ),
    "ix_matter_documents_search_vector": (
        "matter_documents",
        f"immutable_english_tsvector({_joined('title', 'original_filename')})",
    ),
}


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(
        """
        CREATE FUNCTION immutable_english_tsvector(text) RETURNS tsvector AS $$
        BEGIN
            RETURN to_tsvector('pg_catalog.english', $1);
        END;
        $$ LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE STRICT
        """
    )
    for index_name, (table, expression) in _INDEXES.items():
        op.execute(f"CREATE INDEX {index_name} ON {table} USING GIN ({expression})")


def downgrade() -> None:
    """Downgrade schema."""
    for index_name in _INDEXES:
        op.execute(f"DROP INDEX IF EXISTS {index_name}")
    op.execute("DROP FUNCTION IF EXISTS immutable_english_tsvector(text)")
