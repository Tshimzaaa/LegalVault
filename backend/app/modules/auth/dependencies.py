from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.modules.auth.repository import AuthRepository
from app.core.security import decode_access_token
from app.exceptions.auth import InvalidCredentials, InactiveUser
from app.modules.auth.models import User
from app.modules.auth.models.role import UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise InvalidCredentials()

    repo = AuthRepository(db)
    user = repo.get_user_by_id(payload["sub"])
    if not user:
        raise InvalidCredentials()
    if not user.is_active:
        raise InactiveUser()
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.ADMIN:
        raise InvalidCredentials()  # swap for a dedicated PermissionDenied exception later
    return user