# test_create_user.py — run once, then delete
from app.database.session import SessionLocal
from app.modules.auth.repository import AuthRepository
from app.modules.auth.models import User
from app.modules.auth.models.role import UserRole
from app.core.security import hash_password
import uuid

db = SessionLocal()
repo = AuthRepository(db)

# You need a real firm_id that exists in law_firms — grab one first:
# SELECT id FROM law_firms LIMIT 1;
FIRM_ID = "bcf7ec0e-c8bd-4a45-a158-51feb8e4226f"
user = User(
    firm_id=FIRM_ID,
    first_name="Test",
    last_name="User",
    email="test@legalhub.com",
    password_hash=hash_password("Password123!"),
    role=UserRole.ADMIN,
    is_active=True,
)

repo.create_user(user)
db.commit()
print("Created:", user.id, user.email)
db.close()