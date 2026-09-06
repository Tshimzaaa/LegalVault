"""add_resolved_to_intake_submission_status

Step 2 of the support-requests-to-intake merge. Adds a `RESOLVED` value to
the native Postgres enum backing IntakeSubmission.status, carrying over the
old SupportRequestStatus.RESOLVED terminal state ("we helped, no matter was
needed") — distinct from CONVERTED (a matter was created) and DECLINED
(rejected). Note the enum stores the Python enum member *name*, not its
lowercase `.value` (see IntakeSubmissionStatus in app.modules.intake.models
and how c70ad5778c25_add_intake_tables.py recorded the original values), so
the new value here is 'RESOLVED', not 'resolved'.

IMPORTANT: `ALTER TYPE ... ADD VALUE` cannot be used in the same transaction
that added it (Postgres forbids it outright pre-12, and even on 12+ the new
value isn't usable until that transaction commits). This repo's alembic/env.py
runs the stock template — a single transaction wraps every revision applied
by one `alembic upgrade head` call — so a later migration in this merge
(the support_requests backfill) needs 'RESOLVED' to already be committed and
usable. Hence the explicit COMMIT below before the ALTER TYPE.

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-09-05 00:00:01.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("COMMIT")
    op.execute("ALTER TYPE intakesubmissionstatus ADD VALUE IF NOT EXISTS 'RESOLVED' BEFORE 'CONVERTED'")


def downgrade() -> None:
    # Postgres has no direct "remove enum value" — the standard workaround is to swap in a
    # narrower type. This fails (intentionally) if any row still has status='RESOLVED';
    # a downgrade past this point requires no resolved submissions to exist.
    op.execute("COMMIT")
    op.execute(
        "ALTER TYPE intakesubmissionstatus RENAME TO intakesubmissionstatus_old"
    )
    op.execute(
        "CREATE TYPE intakesubmissionstatus AS ENUM ('SUBMITTED', 'IN_REVIEW', 'CONVERTED', 'DECLINED')"
    )
    op.execute(
        "ALTER TABLE intake_submissions "
        "ALTER COLUMN status TYPE intakesubmissionstatus "
        "USING status::text::intakesubmissionstatus"
    )
    op.execute("DROP TYPE intakesubmissionstatus_old")
