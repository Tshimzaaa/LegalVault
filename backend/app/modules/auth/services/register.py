from sqlalchemy.orm import Session
from app.core.config import settings
from app.exceptions.auth import (
    LawFirmAlreadyExists,
    UserAlreadyExists,
    InvalidCredentials
)
from app.modules.auth.repository import AuthRepository
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
from app.modules.audit.service import AuditService
from app.modules.audit.models import ActorType
from app.modules.audit import actions as audit_actions

class RegisterService:

    def __init__(self, db: Session):
        self.db = db
        self.repository = AuthRepository(db)
        self.audit = AuditService(db)

    def register(self, request: RegisterRequest) -> RegisterResponse:
        if request.admin_secret != settings.REGISTER_SECRET:
            raise InvalidCredentials()

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

        hashed_password = hash_password(request.admin.password)

        law_firm = LawFirm(
            name=request.law_firm.name,
            email=request.law_firm.email,
            phone=request.law_firm.phone,
            website=request.law_firm.website,
            address=request.law_firm.address,
        )

        try:
            self.repository.create_law_firm(law_firm)

            user = User(
                firm_id=law_firm.id,
                first_name=request.admin.first_name,
                last_name=request.admin.last_name,
                email=request.admin.email,
                password_hash=hashed_password,
                role=UserRole.ADMIN,
            )

            self.repository.create_user(user)

            self.audit.log(
                actor_type=ActorType.STAFF,
                actor_id=user.id,
                firm_id=law_firm.id,
                action=audit_actions.FIRM_CREATED,
                target_type="law_firm",
                target_id=law_firm.id,
                details={"name": law_firm.name, "email": law_firm.email},
            )
            self.db.commit()

            access_token = create_access_token(subject=str(user.id))

            return RegisterResponse(
                message="Registration successful.",
                law_firm_id=law_firm.id,
                user_id=user.id,
                access_token=access_token,
            )

        except Exception:
            self.db.rollback()
            raise
    def register_as_owner(self, law_firm_request, admin_request) -> RegisterResponse:
        existing_firm = self.repository.get_law_firm_by_email(law_firm_request.email)
        if existing_firm:
            raise LawFirmAlreadyExists()

        existing_user = self.repository.get_user_by_email(admin_request.email)
        if existing_user:
            raise UserAlreadyExists()

        hashed_password = hash_password(admin_request.password)

        law_firm = LawFirm(
            name=law_firm_request.name,
            email=law_firm_request.email,
            phone=law_firm_request.phone,
            website=law_firm_request.website,
            address=law_firm_request.address,
        )

        try:
            self.repository.create_law_firm(law_firm)

            user = User(
                firm_id=law_firm.id,
                first_name=admin_request.first_name,
                last_name=admin_request.last_name,
                email=admin_request.email,
                password_hash=hashed_password,
                role=UserRole.ADMIN,
            )

            self.repository.create_user(user)

            self.audit.log(
                actor_type=ActorType.OWNER,
                actor_id=None,
                firm_id=law_firm.id,
                action=audit_actions.FIRM_CREATED,
                target_type="law_firm",
                target_id=law_firm.id,
                details={"name": law_firm.name, "email": law_firm.email},
            )
            self.db.commit()

            access_token = create_access_token(subject=str(user.id))

            return RegisterResponse(
                message="Registration successful.",
                law_firm_id=law_firm.id,
                user_id=user.id,
                access_token=access_token,
            )

        except Exception:
            self.db.rollback()
            raise