from fastapi import Request, APIRouter, Depends
from sqlalchemy.orm import Session
from app.modules.auth.repository import AuthRepository
from app.database.session import get_db
from app.modules.auth.schemas.login import LoginRequest
from app.modules.auth.schemas.token import TokenResponse
from app.modules.auth.schemas.user import UserResponse, UpdateStaffStatusRequest
from app.modules.auth.schemas.register import RegisterRequest, RegisterResponse
from app.modules.auth.services.login import login_user
from app.modules.auth.services.register import RegisterService
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User
from app.modules.auth.schemas.invite import InviteStaffRequest, AcceptStaffInviteRequest
from app.modules.auth.services.invite import invite_staff, accept_staff_invite
from app.main import limiter  # or restructure to avoid circular import — flag if this errors
from app.modules.auth.schemas.password_reset import ForgotPasswordRequest, ResetPasswordRequest
from app.modules.auth.services.password_reset import request_password_reset, reset_password
from app.modules.auth.dependencies import require_admin
from app.exceptions.auth import StaffNotFound, CannotDeactivateSelf

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(request: Request, credentials: LoginRequest, db: Session = Depends(get_db)):
    return login_user(db, credentials)


@router.post("/register", response_model=RegisterResponse, status_code=201)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    service = RegisterService(db)
    return service.register(request)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/users", response_model=list[UserResponse])
def list_staff(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repo = AuthRepository(db)
    return repo.list_by_firm(current_user.firm_id)
@router.post("/forgot-password", status_code=200)
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    request_password_reset(db, request)
    return {"message": "If that email exists, a reset link has been sent."}

@router.post("/reset-password", status_code=200)
def reset_password_route(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    reset_password(db, request)
    return {"message": "Password reset successful."}
@router.post("/invite-staff", response_model=UserResponse, status_code=201)
def invite_staff_route(
    request: InviteStaffRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return invite_staff(db, current_user.firm_id, request)


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

    if not staff or str(staff.firm_id) != str(current_user.firm_id):
        raise StaffNotFound()

    if str(staff.id) == str(current_user.id):
        raise CannotDeactivateSelf()

    staff.is_active = request.is_active
    db.commit()
    return staff