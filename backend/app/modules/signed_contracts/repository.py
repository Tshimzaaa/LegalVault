from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.clients.models import Client
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

    def list_by_firm(self, firm_id) -> list[tuple[SignedContract, Client]]:
        statement = (
            select(SignedContract, Client)
            .join(Client, SignedContract.client_id == Client.id)
            .where(SignedContract.firm_id == firm_id)
            .order_by(SignedContract.signed_date.desc())
        )
        return list(self.db.execute(statement).all())

    def list_by_client(self, client_id) -> list[tuple[SignedContract, Client]]:
        statement = (
            select(SignedContract, Client)
            .join(Client, SignedContract.client_id == Client.id)
            .where(SignedContract.client_id == client_id)
            .order_by(SignedContract.signed_date.desc())
        )
        return list(self.db.execute(statement).all())

    def list_plain_by_firm(self, firm_id) -> list[SignedContract]:
        return list(self.db.scalars(select(SignedContract).where(SignedContract.firm_id == firm_id)))

    def delete(self, contract: SignedContract):
        self.db.delete(contract)
        self.db.flush()
