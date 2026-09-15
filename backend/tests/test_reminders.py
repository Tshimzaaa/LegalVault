"""
Matter due-date and contract expiry reminder scans (app/tasks/reminders.py). These call
the scan functions directly against db_session — no Celery broker/worker involved — since
db_session already starts in RLS owner-mode (see conftest.py), the same tenant context the
real Celery task wrappers set up via set_tenant_context(..., is_owner=True) before scanning.
"""
from datetime import date, timedelta

from sqlalchemy import select

from app.modules.matters.models import MatterStatus
from app.modules.notifications.models import Notification, RecipientType
from app.modules.signed_contracts.models import ContractStatus
from app.tasks.reminders import (
    CONTRACT_REMINDER_TYPE,
    MATTER_REMINDER_TYPE,
    scan_and_notify_due_matters,
    scan_and_notify_expiring_contracts,
)
from tests.conftest import (
    make_org,
    make_matter,
    make_matter_assignment,
    make_signed_contract,
    make_staff,
)

TODAY = date.today()


def _notifications_for(db_session, notification_type: str) -> list[Notification]:
    return list(db_session.scalars(select(Notification).where(Notification.type == notification_type)))


# ---- matter due-date reminders ------------------------------------------------


def test_matter_due_soon_notifies_each_assigned_staff_user(db_session):
    org = make_org(db_session)
    lawyer, _ = make_staff(db_session, org)
    paralegal, _ = make_staff(db_session, org, email="paralegal@example.com")
    matter = make_matter(db_session, org, due_date=TODAY + timedelta(days=3))
    make_matter_assignment(db_session, matter, lawyer)
    make_matter_assignment(db_session, matter, paralegal)

    created = scan_and_notify_due_matters(db_session)

    assert created == 2
    notifications = _notifications_for(db_session, MATTER_REMINDER_TYPE)
    assert {n.recipient_id for n in notifications} == {lawyer.id, paralegal.id}
    assert all(n.target_id == matter.id for n in notifications)


def test_matter_not_due_soon_excluded(db_session):
    org = make_org(db_session)
    lawyer, _ = make_staff(db_session, org)
    matter = make_matter(db_session, org, due_date=TODAY + timedelta(days=30))
    make_matter_assignment(db_session, matter, lawyer)

    assert scan_and_notify_due_matters(db_session) == 0


def test_matter_no_due_date_excluded(db_session):
    org = make_org(db_session)
    lawyer, _ = make_staff(db_session, org)
    matter = make_matter(db_session, org)
    make_matter_assignment(db_session, matter, lawyer)

    assert scan_and_notify_due_matters(db_session) == 0


def test_matter_closed_or_declined_excluded(db_session):
    org = make_org(db_session)
    lawyer, _ = make_staff(db_session, org)
    for status in (MatterStatus.CLOSED, MatterStatus.DECLINED):
        matter = make_matter(db_session, org, due_date=TODAY + timedelta(days=1), status=status)
        make_matter_assignment(db_session, matter, lawyer)

    assert scan_and_notify_due_matters(db_session) == 0


def test_matter_inactive_assignee_excluded(db_session):
    org = make_org(db_session)
    lawyer, _ = make_staff(db_session, org, is_active=False)
    matter = make_matter(db_session, org, due_date=TODAY + timedelta(days=1))
    make_matter_assignment(db_session, matter, lawyer)

    assert scan_and_notify_due_matters(db_session) == 0


def test_suspended_org_excluded(db_session):
    org = make_org(db_session, is_active=False)
    lawyer, _ = make_staff(db_session, org)
    matter = make_matter(db_session, org, due_date=TODAY + timedelta(days=1))
    make_matter_assignment(db_session, matter, lawyer)

    assert scan_and_notify_due_matters(db_session) == 0


def test_matter_scan_twice_same_window_does_not_duplicate(db_session):
    org = make_org(db_session)
    lawyer, _ = make_staff(db_session, org)
    matter = make_matter(db_session, org, due_date=TODAY + timedelta(days=3))
    make_matter_assignment(db_session, matter, lawyer)

    first_run = scan_and_notify_due_matters(db_session)
    second_run = scan_and_notify_due_matters(db_session)

    assert first_run == 1
    assert second_run == 0
    assert len(_notifications_for(db_session, MATTER_REMINDER_TYPE)) == 1


def test_matter_rescheduled_due_date_within_window_does_not_resend_same_day(db_session):
    """Dedup is anchored on "already reminded about this matter recently", not on the due
    date itself — rescheduling within the window on the same day a reminder already went
    out shouldn't trigger an immediate second send. See _already_reminded's docstring for
    why keying dedup off the due date directly gets this backwards."""
    org = make_org(db_session)
    lawyer, _ = make_staff(db_session, org)
    matter = make_matter(db_session, org, due_date=TODAY + timedelta(days=3))
    make_matter_assignment(db_session, matter, lawyer)

    assert scan_and_notify_due_matters(db_session) == 1

    matter.due_date = TODAY + timedelta(days=6)
    db_session.flush()

    assert scan_and_notify_due_matters(db_session) == 0
    assert len(_notifications_for(db_session, MATTER_REMINDER_TYPE)) == 1


# ---- contract expiry reminders --------------------------------------------


def test_contract_expiring_notifies_uploader(db_session):
    org = make_org(db_session)
    uploader, _ = make_staff(db_session, org)
    contract = make_signed_contract(
        db_session, org, uploaded_by=uploader.id, expiry_date=TODAY + timedelta(days=10)
    )

    created = scan_and_notify_expiring_contracts(db_session)

    assert created == 1
    notifications = _notifications_for(db_session, CONTRACT_REMINDER_TYPE)
    assert notifications[0].recipient_id == uploader.id
    assert notifications[0].target_id == contract.id


def test_contract_archived_excluded(db_session):
    org = make_org(db_session)
    uploader, _ = make_staff(db_session, org)
    make_signed_contract(
        db_session,
        org,
        uploaded_by=uploader.id,
        expiry_date=TODAY + timedelta(days=10),
        status=ContractStatus.ARCHIVED,
    )

    assert scan_and_notify_expiring_contracts(db_session) == 0


def test_contract_no_expiry_date_excluded(db_session):
    org = make_org(db_session)
    uploader, _ = make_staff(db_session, org)
    make_signed_contract(db_session, org, uploaded_by=uploader.id)

    assert scan_and_notify_expiring_contracts(db_session) == 0


def test_contract_not_expiring_soon_excluded(db_session):
    org = make_org(db_session)
    uploader, _ = make_staff(db_session, org)
    make_signed_contract(
        db_session, org, uploaded_by=uploader.id, expiry_date=TODAY + timedelta(days=90)
    )

    assert scan_and_notify_expiring_contracts(db_session) == 0


def test_contract_no_uploader_gets_no_reminder(db_session):
    """Imported contracts with no uploaded_by are a confirmed, intentional gap — there's no
    other staff signal on the record to notify, and guessing a fallback recipient (e.g. every
    admin at the org) was deliberately ruled out rather than left as an accidental oversight."""
    org = make_org(db_session)
    make_signed_contract(
        db_session,
        org,
        uploaded_by=None,
        expiry_date=TODAY + timedelta(days=10),
        integration_source="trackado",
    )

    assert scan_and_notify_expiring_contracts(db_session) == 0


def test_contract_scan_twice_same_window_does_not_duplicate(db_session):
    org = make_org(db_session)
    uploader, _ = make_staff(db_session, org)
    make_signed_contract(
        db_session, org, uploaded_by=uploader.id, expiry_date=TODAY + timedelta(days=10)
    )

    first_run = scan_and_notify_expiring_contracts(db_session)
    second_run = scan_and_notify_expiring_contracts(db_session)

    assert first_run == 1
    assert second_run == 0
    assert len(_notifications_for(db_session, CONTRACT_REMINDER_TYPE)) == 1
