from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.exceptions.auth import (
    LawFirmAlreadyExists,
    UserAlreadyExists,
)
from app.modules.auth.models import LawFirm, User
from app.modules.auth.repository import AuthRepository


class AuthService:

    def __init__(self, db: Session):
        self.repository = AuthRepository(db)

    def register(self, request):
        pass