import secrets
from datetime import datetime, timedelta, UTC
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.clients.models import Client, ClientContact

INVITATION_EXPIRY_HOURS = 48


class ClientRepository:

    def __init__(self, db: Session):
        self.db = db

    def get_client_by_id(self, client_id) -> Client | None:
        return self.db.scalar(select(Client).where(Client.id == client_id))

    def create_client(self, client: Client) -> Client:
        self.db.add(client)
        self.db.flush()
        return client

    def get_contact_by_email(self, email: str) -> ClientContact | None:
        return self.db.scalar(select(ClientContact).where(ClientContact.email == email))

    def get_contact_by_id(self, contact_id) -> ClientContact | None:
        return self.db.scalar(select(ClientContact).where(ClientContact.id == contact_id))

    def get_contact_by_token(self, token: str) -> ClientContact | None:
        return self.db.scalar(select(ClientContact).where(ClientContact.invitation_token == token))

    def create_contact_invite(self, client_id, first_name: str, last_name: str, email: str) -> ClientContact:
        contact = ClientContact(
            client_id=client_id,
            first_name=first_name,
            last_name=last_name,
            email=email,
            password_hash=None,
            invitation_status="pending",
            invitation_token=secrets.token_urlsafe(32),
            invitation_expires_at=datetime.now(UTC) + timedelta(hours=INVITATION_EXPIRY_HOURS),
        )
        self.db.add(contact)
        self.db.flush()
        return contact