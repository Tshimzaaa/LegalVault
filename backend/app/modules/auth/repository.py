from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.auth.models import LawFirm, User


class AuthRepository:

    def __init__(self, db: Session):
        self.db = db

    def get_law_firm_by_email(self, email: str) -> LawFirm | None:
        statement = select(LawFirm).where(LawFirm.email == email)
        return self.db.scalar(statement)

    def get_user_by_email(self, email: str) -> User | None:
        statement = select(User).where(User.email == email)
        return self.db.scalar(statement)

    def create_law_firm(self, law_firm: LawFirm) -> LawFirm:
        self.db.add(law_firm)
        self.db.flush()
        return law_firm

    def create_user(self, user: User) -> User:
        self.db.add(user)
        self.db.flush()
        return user
    def get_user_by_id(self, user_id: str) -> User | None:
        statement = select(User).where(User.id == user_id)
        return self.db.scalar(statement)
    def list_by_firm(self, firm_id) -> list[User]:
        statement = select(User).where(User.firm_id == firm_id)
        return list(self.db.scalars(statement))
    def get_user_by_reset_token(self, token: str) -> User | None:
        statement = select(User).where(User.reset_token == token)
        return self.db.scalar(statement)

    def set_reset_token(self, user: User, token: str, expires_at) -> User:
        user.reset_token = token
        user.reset_token_expires_at = expires_at
        self.db.flush()
        return user

    def clear_reset_token(self, user: User) -> User:
        user.reset_token = None
        user.reset_token_expires_at = None
        self.db.flush()
        return user
    def get_firm_by_id(self, firm_id) -> LawFirm | None:
        return self.db.scalar(select(LawFirm).where(LawFirm.id == firm_id))

    def list_all_firms(self) -> list[LawFirm]:
        return list(self.db.scalars(select(LawFirm)))

    def count_users_for_firm(self, firm_id) -> int:
        from sqlalchemy import func
        return self.db.scalar(select(func.count()).select_from(User).where(User.firm_id == firm_id))

    def get_user_by_invitation_token(self, token: str) -> User | None:
        statement = select(User).where(User.invitation_token == token)
        return self.db.scalar(statement)

    def create_invited_user(self, user: User) -> User:
        self.db.add(user)
        self.db.flush()
        return user

    def delete_user(self, user: User):
        self.db.delete(user)
        self.db.flush()

    def delete_firm(self, law_firm: LawFirm):
        self.db.delete(law_firm)
        self.db.flush()