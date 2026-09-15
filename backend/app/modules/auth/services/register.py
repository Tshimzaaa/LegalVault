from sqlalchemy.orm import Session
from app.exceptions.auth import (
    OrganizationAlreadyExists,
    UserAlreadyExists,
)
from app.modules.auth.repository import AuthRepository
from app.modules.auth.models import (
    Organization,
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
from app.database.rls import set_tenant_context
from app.modules.intake.system_forms import seed_system_support_form

class RegisterService:

    def __init__(self, db: Session):
        self.db = db
        self.repository = AuthRepository(db)
        self.audit = AuditService(db)

    def register(self, request: RegisterRequest) -> RegisterResponse:
        """Public, self-serve signup — anyone can create an organization + its
        first admin. Rate-limited at the route level (see auth/routes.py) since
        this is the one auth endpoint reachable with no prior credential at all."""
        existing_org = self.repository.get_organization_by_email(
            request.organization.email
        )
        if existing_org:
            raise OrganizationAlreadyExists()

        existing_user = self.repository.get_user_by_email(
            request.admin.email
        )
        if existing_user:
            raise UserAlreadyExists()

        hashed_password = hash_password(request.admin.password)

        organization = Organization(
            name=request.organization.name,
            email=request.organization.email,
            phone=request.organization.phone,
            website=request.organization.website,
            address=request.organization.address,
        )

        # No auth dependency has run before this endpoint (it's the public self-serve
        # signup flow, and the org being created doesn't exist yet to scope to) — so
        # unlike every other write path, tenant context was never set. Without this, the
        # audit-log insert below is rejected outright by RLS the moment the runtime role
        # lacks BYPASSRLS.
        set_tenant_context(self.db, org_id=None, is_owner=True)

        try:
            self.repository.create_organization(organization)

            user = User(
                org_id=organization.id,
                first_name=request.admin.first_name,
                last_name=request.admin.last_name,
                email=request.admin.email,
                password_hash=hashed_password,
                role=UserRole.ADMIN,
            )

            self.repository.create_user(user)
            seed_system_support_form(self.db, organization.id)

            self.audit.log(
                actor_type=ActorType.STAFF,
                actor_id=user.id,
                org_id=organization.id,
                action=audit_actions.ORG_CREATED,
                target_type="organization",
                target_id=organization.id,
                details={"name": organization.name, "email": organization.email},
            )
            self.db.commit()

            access_token = create_access_token(subject=str(user.id))

            return RegisterResponse(
                message="Registration successful.",
                organization_id=organization.id,
                user_id=user.id,
                access_token=access_token,
            )

        except Exception:
            self.db.rollback()
            raise
    def register_as_owner(self, organization_request, admin_request) -> RegisterResponse:
        existing_org = self.repository.get_organization_by_email(organization_request.email)
        if existing_org:
            raise OrganizationAlreadyExists()

        existing_user = self.repository.get_user_by_email(admin_request.email)
        if existing_user:
            raise UserAlreadyExists()

        hashed_password = hash_password(admin_request.password)

        organization = Organization(
            name=organization_request.name,
            email=organization_request.email,
            phone=organization_request.phone,
            website=organization_request.website,
            address=organization_request.address,
        )

        try:
            self.repository.create_organization(organization)

            user = User(
                org_id=organization.id,
                first_name=admin_request.first_name,
                last_name=admin_request.last_name,
                email=admin_request.email,
                password_hash=hashed_password,
                role=UserRole.ADMIN,
            )

            self.repository.create_user(user)
            seed_system_support_form(self.db, organization.id)

            self.audit.log(
                actor_type=ActorType.OWNER,
                actor_id=None,
                org_id=organization.id,
                action=audit_actions.ORG_CREATED,
                target_type="organization",
                target_id=organization.id,
                details={"name": organization.name, "email": organization.email},
            )
            self.db.commit()

            access_token = create_access_token(subject=str(user.id))

            return RegisterResponse(
                message="Registration successful.",
                organization_id=organization.id,
                user_id=user.id,
                access_token=access_token,
            )

        except Exception:
            self.db.rollback()
            raise