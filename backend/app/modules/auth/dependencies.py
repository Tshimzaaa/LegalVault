from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from datetime import datetime, UTC

from app.database.session import get_db
from app.database.rls import set_tenant_context
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
    if not payload or "sub" not in payload or "iat" not in payload:
        raise InvalidCredentials()

    repo = AuthRepository(db)
    user = repo.get_user_by_id(payload["sub"])
    if not user:
        raise InvalidCredentials()
    if not user.is_active:
        raise InactiveUser()

    if user.tokens_invalid_before:
        token_issued_at = datetime.fromtimestamp(payload["iat"], tz=UTC)
        if token_issued_at < user.tokens_invalid_before:
            raise InvalidCredentials()

    firm = repo.get_firm_by_id(user.firm_id)
    if not firm or not firm.is_active:
        raise InactiveUser()

    set_tenant_context(db, firm_id=user.firm_id)

    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.ADMIN:
        raise InvalidCredentials()
    return user