import secrets
from datetime import datetime, timedelta, UTC
from sqlalchemy.orm import Session

from app.modules.auth.repository import AuthRepository
from app.modules.auth.models import User
from app.modules.auth.schemas.invite import InviteStaffRequest, AcceptStaffInviteRequest
from app.core.security import hash_password
from app.exceptions.auth import UserAlreadyExists, InvalidOrExpiredInvite, InviteAlreadyAccepted

INVITE_EXPIRY_HOURS = 48


def invite_staff(db: Session, firm_id, request: InviteStaffRequest) -> User:
    repo = AuthRepository(db)
    existing = repo.get_user_by_email(request.email)
    if existing:
        raise UserAlreadyExists()

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(UTC) + timedelta(hours=INVITE_EXPIRY_HOURS)

    user = User(
        firm_id=firm_id,
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