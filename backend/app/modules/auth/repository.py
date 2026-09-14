from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.auth.models import Organization, User


class AuthRepository:

    def __init__(self, db: Session):
        self.db = db

    def get_organization_by_email(self, email: str) -> Organization | None:
        statement = select(Organization).where(Organization.email == email)
        return self.db.scalar(statement)

    def get_user_by_email(self, email: str) -> User | None:
        statement = select(User).where(User.email == email)
        return self.db.scalar(statement)

    def create_organization(self, organization: Organization) -> Organization:
        self.db.add(organization)
        self.db.flush()
        return organization

    def create_user(self, user: User) -> User:
        self.db.add(user)
        self.db.flush()
        return user
    def get_user_by_id(self, user_id: str) -> User | None:
        statement = select(User).where(User.id == user_id)
        return self.db.scalar(statement)
    def list_users_by_ids(self, user_ids) -> list[User]:
        if not user_ids:
            return []
        return list(self.db.scalars(select(User).where(User.id.in_(user_ids))))
    def list_by_org(self, org_id) -> list[User]:
        statement = select(User).where(User.org_id == org_id)
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
    def get_org_by_id(self, org_id) -> Organization | None:
        return self.db.scalar(select(Organization).where(Organization.id == org_id))

    def list_all_orgs(self) -> list[Organization]:
        return list(self.db.scalars(select(Organization)))

    def count_users_for_org(self, org_id) -> int:
        from sqlalchemy import func
        return self.db.scalar(select(func.count()).select_from(User).where(User.org_id == org_id))

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

    def delete_org(self, organization: Organization):
        self.db.delete(organization)
        self.db.flush()

    def count_all_orgs(self) -> int:
        from sqlalchemy import func
        return self.db.scalar(select(func.count()).select_from(Organization))

    def count_active_orgs(self) -> int:
        from sqlalchemy import func
        return self.db.scalar(
            select(func.count()).select_from(Organization).where(Organization.is_active.is_(True))
        )

    def count_all_users(self) -> int:
        from sqlalchemy import func
        return self.db.scalar(select(func.count()).select_from(User))

    def count_orgs_created_since(self, since) -> int:
        from sqlalchemy import func
        return self.db.scalar(
            select(func.count()).select_from(Organization).where(Organization.created_at >= since)
        )