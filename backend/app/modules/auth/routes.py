from fastapi import Request, APIRouter, Depends
from sqlalchemy.orm import Session
from app.modules.auth.repository import AuthRepository
from app.database.session import get_db
from app.modules.auth.schemas.login import LoginRequest
from app.modules.auth.schemas.token import TokenResponse
from app.modules.auth.schemas.user import UserResponse
from app.modules.auth.schemas.register import RegisterRequest, RegisterResponse
from app.modules.auth.services.login import login_user
from app.modules.auth.services.register import RegisterService
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User
from app.main import limiter  # or restructure to avoid circular import — flag if this errors

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(request: Request, credentials: LoginRequest, db: Session = Depends(get_db)):
    return login_user(db, credentials)
@router.post("/login", response_model=TokenResponse)
def login(credentials: LoginRequest, db: Session = Depends(get_db)):
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