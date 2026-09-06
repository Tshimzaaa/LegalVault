"""add_intake_form_system_and_field_key

Additive schema step 1 of the support-requests-to-intake merge (see
app.modules.intake.system_forms for context). Adds `intake_forms.is_system`
(marks the per-firm seeded "Request Support" form so IntakeService can lock
its fields against staff mutation) and `intake_form_fields.key` (a stable
slug for fields on system forms, e.g. "request_type"/"priority", so app code
can find an answer without depending on a human-editable label).

Revision ID: a1b2c3d4e5f6
Revises: 710a35471ab8
Create Date: 2026-09-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '710a35471ab8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('intake_forms', sa.Column('is_system', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('intake_form_fields', sa.Column('key', sa.String(length=100), nullable=True))
    op.execute(
        "CREATE UNIQUE INDEX ix_intake_form_fields_form_id_key "
        "ON intake_form_fields (form_id, key) WHERE key IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_intake_form_fields_form_id_key")
    op.drop_column('intake_form_fields', 'key')
    op.drop_column('intake_forms', 'is_system')
