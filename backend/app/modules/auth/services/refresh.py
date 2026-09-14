from datetime import datetime, timedelta, UTC
from sqlalchemy.orm import Session

from app.modules.auth.repository import AuthRepository
from app.modules.auth.refresh_token_repository import RefreshTokenRepository
from app.modules.auth.models.refresh_token import RefreshTokenActorType
from app.modules.auth.schemas.token import TokenResponse
from app.core.config import settings
from app.core.security import create_access_token, generate_refresh_token, hash_refresh_token
from app.exceptions.auth import InvalidRefreshToken, InactiveUser


def refresh_staff_token(db: Session, raw_refresh_token: str) -> TokenResponse:
    repo = RefreshTokenRepository(db)
    record = repo.get_valid_by_hash(hash_refresh_token(raw_refresh_token), RefreshTokenActorType.STAFF)
    if not record:
        raise InvalidRefreshToken()

    auth_repo = AuthRepository(db)
    user = auth_repo.get_user_by_id(record.actor_id)
    if not user or not user.is_active:
        raise InactiveUser()

    org = auth_repo.get_org_by_id(user.org_id)
    if not org or not org.is_active:
        raise InactiveUser()

    # Rotate: the old token is single-use, so a leaked/replayed token can't be reused.
    repo.revoke(record)
    raw_new_refresh_token = generate_refresh_token()
    repo.create(
        actor_type=RefreshTokenActorType.STAFF,
        actor_id=user.id,
        token_hash=hash_refresh_token(raw_new_refresh_token),
        expires_at=datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.commit()

    access_token = create_access_token(subject=str(user.id))
    return TokenResponse(access_token=access_token, refresh_token=raw_new_refresh_token)


def logout_staff(db: Session, raw_refresh_token: str) -> None:
    repo = RefreshTokenRepository(db)
    record = repo.get_valid_by_hash(hash_refresh_token(raw_refresh_token), RefreshTokenActorType.STAFF)
    if record:
        repo.revoke(record)
        db.commit()
