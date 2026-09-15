from datetime import datetime, UTC

from fastapi import Request, APIRouter, Depends
from sqlalchemy.orm import Session
from app.modules.auth.repository import AuthRepository
from app.database.session import get_db
from app.modules.auth.schemas.login import LoginRequest
from app.modules.auth.schemas.token import TokenResponse, RefreshTokenRequest
from app.modules.auth.schemas.user import UserResponse, UpdateStaffStatusRequest
from app.modules.auth.schemas.register import RegisterRequest, RegisterResponse
from app.modules.auth.services.login import login_user
from app.modules.auth.services.refresh import refresh_staff_token, logout_staff
from app.modules.auth.services.register import RegisterService
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.auth.schemas.invite import InviteStaffRequest, InviteStaffResponse, AcceptStaffInviteRequest
from app.modules.auth.services.invite import invite_staff, accept_staff_invite
from app.main import limiter  # or restructure to avoid circular import — flag if this errors
from app.modules.auth.schemas.password_reset import ForgotPasswordRequest, ResetPasswordRequest
from app.modules.auth.services.password_reset import request_password_reset, reset_password
from app.modules.auth.dependencies import require_admin
from app.exceptions.auth import StaffNotFound, CannotDeactivateSelf, OrganizationAlreadyExists
from app.modules.auth.schemas.organization import OrganizationProfileResponse, UpdateOrganizationProfileRequest
from app.modules.audit.service import AuditService
from app.modules.audit.models import ActorType
from app.modules.audit import actions as audit_actions
from app.modules.auth.refresh_token_repository import RefreshTokenRepository
from app.modules.auth.models.refresh_token import RefreshTokenActorType

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(request: Request, credentials: LoginRequest, db: Session = Depends(get_db)):
    return login_user(db, credentials)


@router.post("/refresh", response_model=TokenResponse)
def refresh(request: RefreshTokenRequest, db: Session = Depends(get_db)):
    return refresh_staff_token(db, request.refresh_token)


@router.post("/logout", status_code=204)
def logout(request: RefreshTokenRequest, db: Session = Depends(get_db)):
    logout_staff(db, request.refresh_token)


@router.post("/register", response_model=RegisterResponse, status_code=201)
@limiter.limit("5/minute")
def register(request: Request, body: RegisterRequest, db: Session = Depends(get_db)):
    service = RegisterService(db)
    return service.register(body)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/users", response_model=list[UserResponse])
def list_staff(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = AuthRepository(db)
    return repo.list_by_org(current_user.org_id)
@router.post("/forgot-password", status_code=200)
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    request_password_reset(db, request)
    return {"message": "If that email exists, a reset link has been sent."}

@router.post("/reset-password", status_code=200)
def reset_password_route(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    reset_password(db, request)
    return {"message": "Password reset successful."}
@router.post("/invite-staff", response_model=InviteStaffResponse, status_code=201)
def invite_staff_route(
    request: InviteStaffRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return invite_staff(db, current_user.org_id, current_user.id, request)


@router.post("/accept-staff-invite", response_model=UserResponse)
def accept_staff_invite_route(request: AcceptStaffInviteRequest, db: Session = Depends(get_db)):
    return accept_staff_invite(db, request)

@router.patch("/users/{staff_id}/status", response_model=UserResponse)
def update_staff_status(
    staff_id: str,
    request: UpdateStaffStatusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    repo = AuthRepository(db)
    staff = repo.get_user_by_id(staff_id)

    if not staff or str(staff.org_id) != str(current_user.org_id):
        raise StaffNotFound()

    if str(staff.id) == str(current_user.id):
        raise CannotDeactivateSelf()

    staff.is_active = request.is_active
    if not request.is_active:
        RefreshTokenRepository(db).revoke_all_for_actor(RefreshTokenActorType.STAFF, staff.id)

    AuditService(db).log(
        actor_type=ActorType.STAFF,
        actor_id=current_user.id,
        org_id=current_user.org_id,
        action=audit_actions.STAFF_STATUS_UPDATED,
        target_type="user",
        target_id=staff.id,
        details={"email": staff.email, "is_active": request.is_active},
    )
    db.commit()
    return staff


@router.post("/users/{staff_id}/force-logout", status_code=204)
def force_logout_staff(
    staff_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Kills a staff member's active sessions right now — every live access
    token stops working immediately (tokens_invalid_before) and every refresh
    token is revoked — without deactivating the account. Useful for a
    lost/compromised device, where the account itself is still fine."""
    repo = AuthRepository(db)
    staff = repo.get_user_by_id(staff_id)

    if not staff or str(staff.org_id) != str(current_user.org_id):
        raise StaffNotFound()

    staff.tokens_invalid_before = datetime.now(UTC)
    RefreshTokenRepository(db).revoke_all_for_actor(RefreshTokenActorType.STAFF, staff.id)

    AuditService(db).log(
        actor_type=ActorType.STAFF,
        actor_id=current_user.id,
        org_id=current_user.org_id,
        action=audit_actions.STAFF_FORCE_LOGOUT,
        target_type="user",
        target_id=staff.id,
        details={"email": staff.email},
    )
    db.commit()


@router.get("/org", response_model=OrganizationProfileResponse)
def get_org_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = AuthRepository(db)
    return repo.get_org_by_id(current_user.org_id)


@router.patch("/org", response_model=OrganizationProfileResponse)
def update_org_profile(
    request: UpdateOrganizationProfileRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    repo = AuthRepository(db)
    org = repo.get_org_by_id(current_user.org_id)

    updates = request.model_dump(exclude_unset=True)

    if "email" in updates and updates["email"] != org.email:
        existing = repo.get_organization_by_email(updates["email"])
        if existing and str(existing.id) != str(org.id):
            raise OrganizationAlreadyExists()

    for field, value in updates.items():
        setattr(org, field, value)

    AuditService(db).log(
        actor_type=ActorType.STAFF,
        actor_id=current_user.id,
        org_id=org.id,
        action=audit_actions.ORG_PROFILE_UPDATED,
        target_type="organization",
        target_id=org.id,
        details=updates,
    )
    db.commit()
    return org