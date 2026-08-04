import secrets
from datetime import datetime, timedelta, UTC
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.modules.clients.models import Client, ClientContact
from app.modules.matters.models import MatterDocument

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
    def list_by_firm(self, firm_id) -> list[Client]:
        return list(self.db.scalars(select(Client).where(Client.firm_id == firm_id)))
    
    def update_invite_token(self, contact, token: str, expires_at):
        contact.invitation_token = token
        contact.invitation_expires_at = expires_at
        self.db.flush()
        return contact
    def get_contact_by_reset_token(self, token: str) -> ClientContact | None:
        return self.db.scalar(select(ClientContact).where(ClientContact.reset_token == token))

    def set_reset_token(self, contact: ClientContact, token: str, expires_at) -> ClientContact:
        contact.reset_token = token
        contact.reset_token_expires_at = expires_at
        self.db.flush()
        return contact

    def clear_reset_token(self, contact: ClientContact) -> ClientContact:
        contact.reset_token = None
        contact.reset_token_expires_at = None
        self.db.flush()
        return contact
    def count_clients_for_firm(self, firm_id) -> int:
        from sqlalchemy import func
        return self.db.scalar(select(func.count()).select_from(Client).where(Client.firm_id == firm_id))

    def list_contacts_for_client(self, client_id) -> list[ClientContact]:
        return list(self.db.scalars(select(ClientContact).where(ClientContact.client_id == client_id)))

    def delete_client(self, client: Client):
        self.db.delete(client)
        self.db.flush()

    def delete_contact(self, contact: ClientContact):
        self.db.delete(contact)
        self.db.flush()

    def clear_contact_document_uploads(self, contact_id):
        self.db.execute(
            update(MatterDocument)
            .where(MatterDocument.uploaded_by_contact_id == contact_id)
            .values(uploaded_by_contact_id=None)
        )