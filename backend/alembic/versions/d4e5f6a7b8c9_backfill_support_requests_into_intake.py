"""backfill_support_requests_into_intake_submissions

Step 4 of the support-requests-to-intake merge. Copies every existing
support_requests row into an intake_submissions row (against that firm's
system "Request Support" form seeded by the previous migration) plus
matching intake_submission_answers rows, before the old table is dropped.

Reuses the original support_requests.id as the new intake_submissions.id
(traceability for anything that logged/emailed the old UUID) and copies
created_at/updated_at verbatim rather than defaulting to migration-run
time — ClientReporting's turnaround-time math depends on real historical
timestamps.

Both support_requests (read) and intake_submissions/intake_submission_answers
(write) are under FORCE ROW LEVEL SECURITY, so this also needs
`SET app.is_owner = 'true'` first, same as the seeding migration before it.

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-09-05 00:00:03.000000

"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

REQUEST_TYPE_LABELS = {
    "NDA": "NDA Review",
    "CONSULTANCY": "Consultancy Agreement",
    "SUPPLIER": "Supplier Agreement",
    "GENERAL": "General Inquiry",
}
PRIORITY_LABELS = {"HIGH": "High", "MEDIUM": "Medium", "LOW": "Low"}
STATUS_MAP = {"OPEN": "SUBMITTED", "IN_PROGRESS": "IN_REVIEW", "RESOLVED": "RESOLVED"}


def upgrade() -> None:
    op.execute("SET app.is_owner = 'true'")
    bind = op.get_bind()

    intake_submissions = sa.table(
        "intake_submissions",
        sa.column("id", sa.UUID()),
        sa.column("firm_id", sa.UUID()),
        sa.column("form_id", sa.UUID()),
        sa.column("client_id", sa.UUID()),
        sa.column("contact_id", sa.UUID()),
        sa.column("status", sa.String()),
        sa.column("converted_matter_id", sa.UUID()),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    intake_submission_answers = sa.table(
        "intake_submission_answers",
        sa.column("id", sa.UUID()),
        sa.column("submission_id", sa.UUID()),
        sa.column("field_id", sa.UUID()),
        sa.column("value", sa.Text()),
        sa.column("created_at", sa.DateTime(timezone=True)),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )

    support_requests = bind.execute(
        sa.text(
            """
            SELECT id, firm_id, client_id, contact_id, request_type, counterparty,
                   priority, needed_by, description, reference_documents, status,
                   created_at, updated_at
            FROM support_requests
            """
        )
    ).all()

    # Cache each firm's system form id and its field ids by key, keyed by firm_id.
    system_form_by_firm: dict = {}
    field_ids_by_firm: dict = {}

    def system_form_for(firm_id):
        if firm_id not in system_form_by_firm:
            system_form_by_firm[firm_id] = bind.execute(
                sa.text("SELECT id FROM intake_forms WHERE firm_id = :firm_id AND is_system = true"),
                {"firm_id": firm_id},
            ).scalar()
        return system_form_by_firm[firm_id]

    def field_ids_for(firm_id):
        if firm_id not in field_ids_by_firm:
            rows = bind.execute(
                sa.text(
                    """
                    SELECT f.key, f.id
                    FROM intake_form_fields f
                    JOIN intake_forms form ON form.id = f.form_id
                    WHERE form.firm_id = :firm_id AND form.is_system = true
                    """
                ),
                {"firm_id": firm_id},
            ).all()
            field_ids_by_firm[firm_id] = {key: field_id for key, field_id in rows}
        return field_ids_by_firm[firm_id]

    for row in support_requests:
        form_id = system_form_for(row.firm_id)
        fields = field_ids_for(row.firm_id)
        if not form_id or not fields:
            continue  # firm has no seeded system form (shouldn't happen, skip defensively)

        bind.execute(
            intake_submissions.insert().values(
                id=row.id,
                firm_id=row.firm_id,
                form_id=form_id,
                client_id=row.client_id,
                contact_id=row.contact_id,
                status=STATUS_MAP[row.status],
                converted_matter_id=None,
                created_at=row.created_at,
                updated_at=row.updated_at,
            )
        )

        answers = [
            (fields["request_type"], REQUEST_TYPE_LABELS[row.request_type]),
            (fields["priority"], PRIORITY_LABELS[row.priority]),
            (fields["description"], row.description),
        ]
        if row.counterparty:
            answers.append((fields["counterparty"], row.counterparty))
        if row.needed_by:
            answers.append((fields["needed_by"], row.needed_by.isoformat()))
        if row.reference_documents:
            answers.append((fields["reference_documents"], row.reference_documents))

        for field_id, value in answers:
            bind.execute(
                intake_submission_answers.insert().values(
                    id=uuid.uuid4(),
                    submission_id=row.id,
                    field_id=field_id,
                    value=value,
                    created_at=row.created_at,
                    updated_at=row.created_at,
                )
            )


def downgrade() -> None:
    op.execute("SET app.is_owner = 'true'")
    op.execute(
        """
        DELETE FROM intake_submission_answers
        WHERE submission_id IN (
            SELECT s.id FROM intake_submissions s
            JOIN intake_forms f ON f.id = s.form_id
            WHERE f.is_system = true
        )
        """
    )
    op.execute(
        """
        DELETE FROM intake_submissions
        WHERE form_id IN (SELECT id FROM intake_forms WHERE is_system = true)
        """
    )
