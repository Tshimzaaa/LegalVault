from datetime import date, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database.rls import set_tenant_context
from app.database.session import get_db_session
from app.modules.auth.models import LawFirm, User
from app.modules.matters.models import Matter, MatterAssignment, MatterStatus
from app.modules.notifications.models import Notification, RecipientType
from app.modules.notifications.service import NotificationService
from app.modules.signed_contracts.models import ContractStatus, SignedContract
from app.modules.signed_contracts.service import EXPIRING_SOON_WINDOW_DAYS
from app.tasks.celery_app import celery_app

MATTER_DUE_SOON_WINDOW_DAYS = 7
INACTIVE_MATTER_STATUSES = (MatterStatus.CLOSED, MatterStatus.DECLINED)
MATTER_REMINDER_TYPE = "matter_due_soon"

CONTRACT_REMINDER_TYPE = "contract_expiring_soon"


def _already_reminded(existing: dict[tuple[UUID, UUID], date], target_id: UUID, recipient_id: UUID, cutoff: date) -> bool:
    """True if a reminder of this type already went to this recipient for this target
    within the last WINDOW_DAYS days. Deliberately anchored on today (`cutoff`), not on
    the matter/contract's due/expiry date: keying off the date itself gets the direction
    backwards when a date is rescheduled (a later date pushes the window later too, so
    "already sent" would trigger *more* easily, not less, on a schedule change bumped
    further out). One reminder per WINDOW_DAYS period per (target, recipient) is the
    simplest correct rule that still prevents daily re-notification for the same
    upcoming deadline."""
    last_sent = existing.get((target_id, recipient_id))
    return last_sent is not None and last_sent >= cutoff


def scan_and_notify_due_matters(db: Session) -> int:
    """Finds matters due within MATTER_DUE_SOON_WINDOW_DAYS days and notifies every staff
    user assigned to them, skipping anyone already reminded about that matter in the last
    MATTER_DUE_SOON_WINDOW_DAYS days. Does not commit — the caller owns the session's
    transaction lifecycle."""
    today = date.today()
    window_end = today + timedelta(days=MATTER_DUE_SOON_WINDOW_DAYS)

    matters = list(
        db.scalars(
            select(Matter)
            .join(LawFirm, LawFirm.id == Matter.firm_id)
            .where(
                Matter.due_date.is_not(None),
                Matter.due_date >= today,
                Matter.due_date <= window_end,
                Matter.status.not_in(INACTIVE_MATTER_STATUSES),
                LawFirm.is_active.is_(True),
            )
        )
    )
    if not matters:
        return 0

    matter_ids = [matter.id for matter in matters]

    assignee_rows = db.execute(
        select(MatterAssignment.matter_id, User)
        .join(User, User.id == MatterAssignment.user_id)
        .where(MatterAssignment.matter_id.in_(matter_ids), User.is_active.is_(True))
    ).all()
    assignees_by_matter: dict[UUID, list[User]] = {}
    for matter_id, user in assignee_rows:
        assignees_by_matter.setdefault(matter_id, []).append(user)

    cutoff = today - timedelta(days=MATTER_DUE_SOON_WINDOW_DAYS)
    existing = _existing_reminders(db, MATTER_REMINDER_TYPE, matter_ids, cutoff)

    entries = []
    for matter in matters:
        for user in assignees_by_matter.get(matter.id, []):
            if _already_reminded(existing, matter.id, user.id, cutoff):
                continue
            entries.append({
                "recipient_type": RecipientType.STAFF,
                "recipient_id": user.id,
                "type": MATTER_REMINDER_TYPE,
                "title": f"Matter due soon: {matter.title}",
                "body": f'"{matter.title}" is due on {matter.due_date.isoformat()}.',
                "target_type": "matter",
                "target_id": matter.id,
            })

    NotificationService(db).notify_many(entries)
    return len(entries)


def scan_and_notify_expiring_contracts(db: Session) -> int:
    """Finds signed contracts expiring within EXPIRING_SOON_WINDOW_DAYS days and notifies
    the staff user who uploaded them, skipping anyone already reminded about that contract
    in the last EXPIRING_SOON_WINDOW_DAYS days. Contracts with no uploaded_by (e.g. imported
    from an external tool) are skipped — there's no other staff signal on the record to
    notify. Does not commit."""
    today = date.today()
    window_end = today + timedelta(days=EXPIRING_SOON_WINDOW_DAYS)

    contracts = list(
        db.scalars(
            select(SignedContract)
            .join(LawFirm, LawFirm.id == SignedContract.firm_id)
            .where(
                SignedContract.expiry_date.is_not(None),
                SignedContract.expiry_date >= today,
                SignedContract.expiry_date <= window_end,
                SignedContract.status != ContractStatus.ARCHIVED,
                SignedContract.uploaded_by.is_not(None),
                LawFirm.is_active.is_(True),
            )
        )
    )
    if not contracts:
        return 0

    uploader_ids = {contract.uploaded_by for contract in contracts}
    active_uploader_ids = set(
        db.scalars(select(User.id).where(User.id.in_(uploader_ids), User.is_active.is_(True)))
    )
    contracts = [c for c in contracts if c.uploaded_by in active_uploader_ids]
    if not contracts:
        return 0

    contract_ids = [contract.id for contract in contracts]
    cutoff = today - timedelta(days=EXPIRING_SOON_WINDOW_DAYS)
    existing = _existing_reminders(db, CONTRACT_REMINDER_TYPE, contract_ids, cutoff)

    entries = []
    for contract in contracts:
        if _already_reminded(existing, contract.id, contract.uploaded_by, cutoff):
            continue
        entries.append({
            "recipient_type": RecipientType.STAFF,
            "recipient_id": contract.uploaded_by,
            "type": CONTRACT_REMINDER_TYPE,
            "title": f"Contract expiring soon: {contract.title}",
            "body": f'"{contract.title}" expires on {contract.expiry_date.isoformat()}.',
            "target_type": "signed_contract",
            "target_id": contract.id,
        })

    NotificationService(db).notify_many(entries)
    return len(entries)


def _existing_reminders(
    db: Session, reminder_type: str, target_ids: list[UUID], cutoff: date
) -> dict[tuple[UUID, UUID], date]:
    """Latest created_at (as a date) per (target_id, recipient_id) for a given reminder
    type, since `cutoff` — anything older than that is irrelevant to dedup and left out."""
    rows = db.execute(
        select(Notification.target_id, Notification.recipient_id, func.max(Notification.created_at))
        .where(
            Notification.type == reminder_type,
            Notification.recipient_type == RecipientType.STAFF,
            Notification.target_id.in_(target_ids),
            Notification.created_at >= cutoff,
        )
        .group_by(Notification.target_id, Notification.recipient_id)
    ).all()
    return {(target_id, recipient_id): last_created.date() for target_id, recipient_id, last_created in rows}


@celery_app.task(name="app.tasks.reminders.send_matter_due_date_reminders")
def send_matter_due_date_reminders() -> int:
    with get_db_session() as db:
        set_tenant_context(db, firm_id=None, is_owner=True)
        return scan_and_notify_due_matters(db)


@celery_app.task(name="app.tasks.reminders.send_contract_expiry_reminders")
def send_contract_expiry_reminders() -> int:
    with get_db_session() as db:
        set_tenant_context(db, firm_id=None, is_owner=True)
        return scan_and_notify_expiring_contracts(db)
