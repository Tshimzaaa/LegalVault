import secrets
from datetime import datetime, timedelta, UTC
from sqlalchemy.orm import Session

from app.modules.auth.repository import AuthRepository
from app.modules.auth.models import User
from app.modules.auth.schemas.invite import InviteStaffRequest, AcceptStaffInviteRequest
from app.core.security import hash_password
from app.exceptions.auth import UserAlreadyExists, InvalidOrExpiredInvite, InviteAlreadyAccepted
from app.modules.audit.service import AuditService
from app.modules.audit.models import ActorType
from app.modules.audit import actions as audit_actions

INVITE_EXPIRY_HOURS = 48


def invite_staff(db: Session, org_id, actor_id, request: InviteStaffRequest) -> User:
    repo = AuthRepository(db)
    existing = repo.get_user_by_email(request.email)
    if existing:
        raise UserAlreadyExists()

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(UTC) + timedelta(hours=INVITE_EXPIRY_HOURS)

    user = User(
        org_id=org_id,
        first_name=request.first_name,
        last_name=request.last_name,
        email=request.email,
        password_hash=None,
        role=request.role,
        invitation_status="pending",
        invitation_token=token,
        invitation_expires_at=expires_at,
    )
    repo.create_invited_user(user)

    AuditService(db).log(
        actor_type=ActorType.STAFF,
        actor_id=actor_id,
        org_id=org_id,
        action=audit_actions.STAFF_INVITED,
        target_type="user",
        target_id=user.id,
        details={"email": user.email, "role": user.role.value},
    )
    db.commit()

    invite_link = f"https://yourapp.com/accept-staff-invite?token={token}"
    print(f"[STUB EMAIL] Staff invitation for {user.email}: {invite_link}")

    return user


def accept_staff_invite(db: Session, request: AcceptStaffInviteRequest) -> User:
    repo = AuthRepository(db)
    user = repo.get_user_by_invitation_token(request.token)

    if not user:
        raise InvalidOrExpiredInvite()
    if user.invitation_status == "accepted":
        raise InviteAlreadyAccepted()
    if user.invitation_expires_at < datetime.now(UTC):
        raise InvalidOrExpiredInvite()

    user.password_hash = hash_password(request.password)
    user.invitation_status = "accepted"
    user.invitation_token = None
    user.invitation_expires_at = None

    db.commit()
    return user