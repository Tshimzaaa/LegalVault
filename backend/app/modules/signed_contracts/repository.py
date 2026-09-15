from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.signed_contracts.models import SignedContract


class SignedContractRepository:

    def __init__(self, db: Session):
        self.db = db

    def create(self, contract: SignedContract) -> SignedContract:
        self.db.add(contract)
        self.db.flush()
        return contract

    def get_by_id(self, contract_id) -> SignedContract | None:
        return self.db.scalar(select(SignedContract).where(SignedContract.id == contract_id))

    def list_by_org(self, org_id) -> list[SignedContract]:
        statement = (
            select(SignedContract)
            .where(SignedContract.org_id == org_id)
            .order_by(SignedContract.signed_date.desc())
        )
        return list(self.db.scalars(statement))

    def list_plain_by_org(self, org_id) -> list[SignedContract]:
        return self.list_by_org(org_id)

    def delete(self, contract: SignedContract):
        self.db.delete(contract)
        self.db.flush()
