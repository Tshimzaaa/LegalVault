from sqlalchemy.orm import Session
from datetime import datetime, UTC

from app.modules.auth.repository import AuthRepository
from app.modules.auth.schemas.login import LoginRequest
from app.modules.auth.schemas.token import TokenResponse
from app.core.security import verify_password, create_access_token
from app.exceptions.auth import InvalidCredentials, InactiveUser


def login_user(db: Session, credentials: LoginRequest) -> TokenResponse:
    repo = AuthRepository(db)
    user = repo.get_user_by_email(credentials.email)

    # Same error for "no user" and "wrong password" — don't leak which emails exist
    if not user or not verify_password(credentials.password, user.password_hash):
        raise InvalidCredentials()

    if not user.is_active:
        raise InactiveUser()

    user.last_login = datetime.now(UTC)
    db.commit()

    token = create_access_token(subject=str(user.id))
    return TokenResponse(access_token=token)