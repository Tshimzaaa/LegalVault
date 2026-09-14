from sqlalchemy.orm import Session
from datetime import datetime, timedelta, UTC

from app.modules.auth.repository import AuthRepository
from app.modules.auth.refresh_token_repository import RefreshTokenRepository
from app.modules.auth.models.refresh_token import RefreshTokenActorType
from app.modules.auth.schemas.login import LoginRequest
from app.modules.auth.schemas.token import TokenResponse
from app.core.config import settings
from app.core.security import verify_password, create_access_token, generate_refresh_token, hash_refresh_token
from app.exceptions.auth import InvalidCredentials, InactiveUser


def login_user(db: Session, credentials: LoginRequest) -> TokenResponse:
    repo = AuthRepository(db)
    user = repo.get_user_by_email(credentials.email)

    # Same error for "no user" and "wrong password" — don't leak which emails exist
    if not user or not verify_password(credentials.password, user.password_hash):
        raise InvalidCredentials()

    if not user.is_active:
        raise InactiveUser()
    org = repo.get_org_by_id(user.org_id)  # or however you access AuthRepository here
    if not org or not org.is_active:
        raise InactiveUser()  # reuse existing exception, or add a dedicated OrganizationSuspended one
    user.last_login = datetime.now(UTC)

    raw_refresh_token = generate_refresh_token()
    RefreshTokenRepository(db).create(
        actor_type=RefreshTokenActorType.STAFF,
        actor_id=user.id,
        token_hash=hash_refresh_token(raw_refresh_token),
        expires_at=datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.commit()

    token = create_access_token(subject=str(user.id))
    return TokenResponse(access_token=token, refresh_token=raw_refresh_token)
