from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.modules.auth.models.refresh_token import RefreshToken, RefreshTokenActorType


class RefreshTokenRepository:

    def __init__(self, db: Session):
        self.db = db

    def create(self, actor_type: RefreshTokenActorType, actor_id, token_hash: str, expires_at) -> RefreshToken:
        record = RefreshToken(
            actor_type=actor_type,
            actor_id=actor_id,
            token_hash=token_hash,
            expires_at=expires_at,
        )
        self.db.add(record)
        self.db.flush()
        return record

    def get_valid_by_hash(self, token_hash: str, actor_type: RefreshTokenActorType) -> RefreshToken | None:
        statement = select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.actor_type == actor_type,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > datetime.now(UTC),
        )
        return self.db.scalar(statement)

    def revoke(self, record: RefreshToken):
        record.revoked_at = datetime.now(UTC)
        self.db.flush()

    def revoke_all_for_actor(self, actor_type: RefreshTokenActorType, actor_id):
        self.db.execute(
            update(RefreshToken)
            .where(
                RefreshToken.actor_type == actor_type,
                RefreshToken.actor_id == actor_id,
                RefreshToken.revoked_at.is_(None),
            )
            .values(revoked_at=datetime.now(UTC))
        )
