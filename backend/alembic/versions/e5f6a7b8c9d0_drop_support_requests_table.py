"""drop_support_requests_table

Final step of the support-requests-to-intake merge. Drops support_requests
now that every row has been copied into intake_submissions/
intake_submission_answers (previous migration) — dropping the table
auto-drops its owned RLS policy (tenant_isolation, from
d4b2e6f18a3c_add_row_level_security.py) and its ix_support_requests_firm_id
index, since Postgres cascades those with the table.

What it does NOT auto-drop: the three native enum types backing the old
columns (supportrequesttype/supportrequestpriority/supportrequeststatus) are
independent catalog objects, not owned by the table — dropped explicitly
below or they'd linger as orphans and confuse future autogenerate diffs.

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-09-05 00:00:04.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table('support_requests')
    op.execute("DROP TYPE supportrequeststatus")
    op.execute("DROP TYPE supportrequestpriority")
    op.execute("DROP TYPE supportrequesttype")


def downgrade() -> None:
    op.execute(
        "CREATE TYPE supportrequesttype AS ENUM ('NDA', 'CONSULTANCY', 'SUPPLIER', 'GENERAL')"
    )
    op.execute(
        "CREATE TYPE supportrequestpriority AS ENUM ('HIGH', 'MEDIUM', 'LOW')"
    )
    op.execute(
        "CREATE TYPE supportrequeststatus AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED')"
    )
    op.create_table(
        'support_requests',
        sa.Column('firm_id', sa.UUID(), nullable=False),
        sa.Column('client_id', sa.UUID(), nullable=False),
        sa.Column('contact_id', sa.UUID(), nullable=False),
        sa.Column(
            'request_type',
            sa.Enum('NDA', 'CONSULTANCY', 'SUPPLIER', 'GENERAL', name='supportrequesttype'),
            nullable=False,
        ),
        sa.Column('counterparty', sa.String(length=200), nullable=True),
        sa.Column(
            'priority',
            sa.Enum('HIGH', 'MEDIUM', 'LOW', name='supportrequestpriority'),
            nullable=False,
        ),
        sa.Column('needed_by', sa.Date(), nullable=True),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('reference_documents', sa.String(length=500), nullable=True),
        sa.Column(
            'status',
            sa.Enum('OPEN', 'IN_PROGRESS', 'RESOLVED', name='supportrequeststatus'),
            nullable=False,
        ),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id'], name=op.f('fk_support_requests_client_id_clients')),
        sa.ForeignKeyConstraint(
            ['contact_id'], ['client_contacts.id'], name=op.f('fk_support_requests_contact_id_client_contacts')
        ),
        sa.ForeignKeyConstraint(['firm_id'], ['law_firms.id'], name=op.f('fk_support_requests_firm_id_law_firms')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_support_requests')),
    )
    op.create_index(op.f('ix_support_requests_firm_id'), 'support_requests', ['firm_id'], unique=False)
    op.execute("ALTER TABLE support_requests ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE support_requests FORCE ROW LEVEL SECURITY")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON support_requests
        USING (
            current_setting('app.is_owner', true) = 'true'
            OR firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid
        )
        WITH CHECK (
            current_setting('app.is_owner', true) = 'true'
            OR firm_id = NULLIF(current_setting('app.current_firm_id', true), '')::uuid
        )
        """
    )
