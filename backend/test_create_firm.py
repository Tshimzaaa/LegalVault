from app.database.session import SessionLocal
from app.modules.auth.repository import AuthRepository
from app.modules.auth.models import LawFirm

db = SessionLocal()
repo = AuthRepository(db)

firm = LawFirm(
    name="Test Law Firm",
    email="testfirm@legalhub.com",
    phone="0123456789",
    website="https://test.com",
    address="123 Test Street",
    is_active=True,
)

repo.create_law_firm(firm)
db.commit()
print("Created firm:", firm.id, firm.name)
db.close()