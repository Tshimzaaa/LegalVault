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

