"""add matter approvals

Adds matter_approvals, backing the new approval gate on the two status transitions
that matter most (awaiting_signature -> signed, signed -> closed) — see
MATTER_STATUS_TRANSITIONS / GATED_TRANSITIONS in app/modules/matters/service.py.
The MatterStatus enum itself is untouched; from_status/to_status just reuse it.
RLS follows the same indirect-via-parent-FK pattern as
matter_contact_permissions in 5a1e9f3c7b2d, since this table has no firm_id of
its own (scoped through matters.firm_id). A partial unique index enforces "one
pending approval per matter" at the DB level, backing up the same check already
done in MatterService.request_status_approval.

Revision ID: 2d9a14027e1f
Revises: 5a1e9f3c7b2d
Create Date: 2026-08-25 09:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM

# revision identifiers, used by Alembic.
revision: str = '2d9a14027e1f'
down_revision: Union[str, Sequence[str], None] = '5a1e9f3c7b2d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLE = "matter_approvals"
_CURRENT_FIRM_ID = "NULLIF(current_setting('app.current_firm_id', true), '')::uuid"
_IS_OWNER = "current_setting('app.is_owner', true) = 'true'"

# PG_ENUM(..., create_type=False): the `matterstatus` enum already exists (created by the
# matters table's migration) — these columns reuse it rather than emitting a duplicate
# CREATE TYPE. The generic sa.Enum(..., create_type=False) does NOT suppress that DDL —
# only the postgres-dialect-specific ENUM class honors the flag (see the same gotcha
# documented in 86d45629cb53_add_signature_requests_and_recipients_.py).
def _matter_status_enum():
    return PG_ENUM(
        'INTAKE', 'IN_REVIEW', 'AWAITING_SIGNATURE', 'SIGNED', 'CLOSED', 'DECLINED',
        name='matterstatus', create_type=False,
    )


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        _TABLE,
        sa.Column('matter_id', sa.UUID(), nullable=False),
        sa.Column('requested_by', sa.UUID(), nullable=False),
        sa.Column('from_status', _matter_status_enum(), nullable=False),
        sa.Column('to_status', _matter_status_enum(), nullable=False),
        sa.Column('status', sa.Enum('PENDING', 'APPROVED', 'REJECTED', name='matterapprovalstatus'), nullable=False),
        sa.Column('decided_by', sa.UUID(), nullable=True),
        sa.Column('decided_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('decision_note', sa.String(length=500), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['matter_id'], ['matters.id'], name=op.f('fk_matter_approvals_matter_id_matters')),
        sa.ForeignKeyConstraint(['requested_by'], ['users.id'], name=op.f('fk_matter_approvals_requested_by_users')),
        sa.ForeignKeyConstraint(['decided_by'], ['users.id'], name=op.f('fk_matter_approvals_decided_by_users')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_matter_approvals')),
    )
    op.create_index(op.f('ix_matter_approvals_matter_id'), _TABLE, ['matter_id'], unique=False)
    op.create_index(op.f('ix_matter_approvals_status'), _TABLE, ['status'], unique=False)
    op.execute(
        f"CREATE UNIQUE INDEX ix_{_TABLE}_one_pending_per_matter ON {_TABLE} (matter_id) "
        f"WHERE status = 'PENDING'"
    )

    op.execute(f"ALTER TABLE {_TABLE} ENABLE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {_TABLE} FORCE ROW LEVEL SECURITY")
    exists_clause = f"""
        EXISTS (
            SELECT 1 FROM matters
            WHERE matters.id = {_TABLE}.matter_id
            AND matters.firm_id = {_CURRENT_FIRM_ID}
        )
    """
    op.execute(
        f"""
        CREATE POLICY tenant_isolation ON {_TABLE}
        USING ({_IS_OWNER} OR {exists_clause})
        WITH CHECK ({_IS_OWNER} OR {exists_clause})
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {_TABLE}")
    op.execute(f"ALTER TABLE {_TABLE} NO FORCE ROW LEVEL SECURITY")
    op.execute(f"ALTER TABLE {_TABLE} DISABLE ROW LEVEL SECURITY")
    op.execute(f"DROP INDEX IF EXISTS ix_{_TABLE}_one_pending_per_matter")
    op.drop_index(op.f('ix_matter_approvals_status'), table_name=_TABLE)
    op.drop_index(op.f('ix_matter_approvals_matter_id'), table_name=_TABLE)
    op.drop_table(_TABLE)
    sa.Enum(name='matterapprovalstatus').drop(op.get_bind(), checkfirst=True)
