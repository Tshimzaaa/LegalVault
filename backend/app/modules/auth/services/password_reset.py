import secrets
from datetime import datetime, timedelta, UTC
from sqlalchemy.orm import Session

from app.modules.auth.repository import AuthRepository
from app.modules.auth.refresh_token_repository import RefreshTokenRepository
from app.modules.auth.models.refresh_token import RefreshTokenActorType
from app.modules.auth.schemas.password_reset import ForgotPasswordRequest, ResetPasswordRequest
from app.core.security import hash_password
from app.exceptions.auth import InvalidOrExpiredResetToken

RESET_TOKEN_EXPIRY_HOURS = 1


def request_password_reset(db: Session, request: ForgotPasswordRequest):
    repo = AuthRepository(db)
    user = repo.get_user_by_email(request.email)

    if not user:
        # Don't reveal whether the email exists — same principle as login
        return

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(UTC) + timedelta(hours=RESET_TOKEN_EXPIRY_HOURS)
    repo.set_reset_token(user, token, expires_at)
    db.commit()

    reset_link = f"https://yourapp.com/reset-password?token={token}"
    print(f"[STUB EMAIL] Password reset for {user.email}: {reset_link}")


def reset_password(db: Session, request: ResetPasswordRequest):
    repo = AuthRepository(db)
    user = repo.get_user_by_reset_token(request.token)

    if not user or not user.reset_token_expires_at or user.reset_token_expires_at < datetime.now(UTC):
        raise InvalidOrExpiredResetToken()

    user.password_hash = hash_password(request.new_password)
    user.tokens_invalid_before = datetime.now(UTC)
    repo.clear_reset_token(user)
    RefreshTokenRepository(db).revoke_all_for_actor(RefreshTokenActorType.STAFF, user.id)
    db.commit()