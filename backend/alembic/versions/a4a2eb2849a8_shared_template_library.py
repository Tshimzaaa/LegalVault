"""shared template library

Part of the corporate-pivot rebuild: templates stop being strictly per-org.
org_id becomes nullable — NULL means a shared, platform-curated template
visible to every org (created via the Owner console, which bypasses RLS
entirely in owner mode). The tenant_isolation policy is updated so a NULL
org_id template is readable by anyone (USING allows org_id IS NULL) but
still only writable within the owner's is_owner bypass or by the org that
owns it (WITH CHECK is unchanged — org_id must equal the current org, so a
regular org can never write org_id = NULL for itself).

Revision ID: a4a2eb2849a8
Revises: b5fc97d5dec6
Create Date: 2026-09-15 03:30:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a4a2eb2849a8'
down_revision: Union[str, Sequence[str], None] = 'b5fc97d5dec6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_IS_OWNER = "current_setting('app.is_owner', true) = 'true'"
_CURRENT_ORG_ID = "NULLIF(current_setting('app.current_org_id', true), '')::uuid"


def upgrade() -> None:
    op.alter_column("templates", "org_id", nullable=True)

    op.execute(
        f"""
        ALTER POLICY tenant_isolation ON templates
        USING ({_IS_OWNER} OR org_id = {_CURRENT_ORG_ID} OR org_id IS NULL)
        WITH CHECK ({_IS_OWNER} OR org_id = {_CURRENT_ORG_ID})
        """
    )


def downgrade() -> None:
    op.execute(
        f"""
        ALTER POLICY tenant_isolation ON templates
        USING ({_IS_OWNER} OR org_id = {_CURRENT_ORG_ID})
        WITH CHECK ({_IS_OWNER} OR org_id = {_CURRENT_ORG_ID})
        """
    )

    # Any existing shared (org_id IS NULL) templates would violate the reinstated
    # NOT NULL constraint — this downgrade path assumes none exist yet, matching
    # every other migration's assumption that this is a fresh, isolated database
    # with no production data to protect (see the org-rename migration's notes).
    op.alter_column("templates", "org_id", nullable=False)
