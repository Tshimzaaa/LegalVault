from sqlalchemy.orm import Session

from app.exceptions.auth import (
    LawFirmAlreadyExists,
    UserAlreadyExists,
)
from app.modules.auth.repository import AuthRepository
from app.core.security import hash_password
from app.modules.auth.models import (
    LawFirm,
    User,
    UserRole,
)
from app.core.security import (
    create_access_token,
    hash_password,
)

from app.modules.auth.schemas.register import (
    RegisterRequest,
    RegisterResponse,
)

class RegisterService:

    def __init__(self, db: Session):
        self.db = db
        self.repository = AuthRepository(db)

    def register(self, request: RegisterRequest,) -> RegisterResponse:

        existing_firm = self.repository.get_law_firm_by_email(
            request.law_firm.email
        )

        if existing_firm:
            raise LawFirmAlreadyExists()

        existing_user = self.repository.get_user_by_email(
            request.admin.email
        )

        if existing_user:
            raise UserAlreadyExists()
        hashed_password = hash_password(
            request.admin.password
        )
        law_firm = LawFirm(
            name=request.law_firm.name,
            email=request.law_firm.email,
            phone=request.law_firm.phone,
            website=request.law_firm.website,
            address=request.law_firm.address,
        )
        user = User(
            firm_id=law_firm.id,
            first_name=request.admin.first_name,
            last_name=request.admin.last_name,
            email=request.admin.email,
            password_hash=hashed_password,
            role=UserRole.ADMIN,
        )
        try:
            self.repository.create_law_firm(law_firm)
            self.repository.create_user(user)

            self.db.commit()

            access_token = create_access_token(
                subject=user.id,
            )

            return RegisterResponse(
                message="Registration successful.",
                law_firm_id=law_firm.id,
                user_id=user.id,
                access_token=access_token,
            )

        except Exception:
            self.db.rollback()
            raise