import secrets
from datetime import datetime,timedelta, UTC
from sqlalchemy.orm import Session

from app.modules.clients.repository import ClientRepository
from app.modules.clients.models import Client
from app.modules.clients.schemas import (
    CreateClientRequest,
    InviteContactRequest,
    AcceptInviteRequest,
    ClientLoginRequest,
    ClientTokenResponse,
)
from app.core.security import hash_password, verify_password, create_access_token
from app.exceptions.clients import (
    ClientNotFound,
    ContactAlreadyExists,
    InvalidOrExpiredInvite,
    InviteAlreadyAccepted,
    InvalidClientCredentials,
    InactiveContact,
    ContactNotFound,
)


class ClientService:

    def __init__(self, db: Session):
        self.db = db
        self.repository = ClientRepository(db)

    def create_client(self, firm_id, request: CreateClientRequest) -> Client:
        client = Client(firm_id=firm_id, company_name=request.company_name)
        self.repository.create_client(client)
        self.db.commit()
        return client

    def invite_contact(self, client_id, request: InviteContactRequest, staff_firm_id):
        client = self.repository.get_client_by_id(client_id)
        if not client:
            raise ClientNotFound()

        if str(client.firm_id) != str(staff_firm_id):
            raise ClientNotFound()  # deliberately vague — don't reveal the client exists under another firm

        existing = self.repository.get_contact_by_email(request.email)
        if existing:
            raise ContactAlreadyExists()

        contact = self.repository.create_contact_invite(
            client_id=client_id,
            first_name=request.first_name,
            last_name=request.last_name,
            email=request.email,
        )
        self.db.commit()

        invite_link = f"https://yourapp.com/accept-invite?token={contact.invitation_token}"
        print(f"[STUB EMAIL] Invitation for {contact.email}: {invite_link}")

        return contact

    def accept_invite(self, request: AcceptInviteRequest):
        contact = self.repository.get_contact_by_token(request.token)
        if not contact:
            raise InvalidOrExpiredInvite()

        if contact.invitation_status == "accepted":
            raise InviteAlreadyAccepted()

        if contact.invitation_expires_at < datetime.now(UTC):
            raise InvalidOrExpiredInvite()

        contact.password_hash = hash_password(request.password)
        contact.invitation_status = "accepted"
        contact.invitation_token = None
        contact.invitation_expires_at = None

        self.db.commit()
        return contact

    def login(self, request: ClientLoginRequest) -> ClientTokenResponse:
        contact = self.repository.get_contact_by_email(request.email)

        if not contact or not contact.password_hash or not verify_password(request.password, contact.password_hash):
            raise InvalidClientCredentials()

        if not contact.is_active:
            raise InactiveContact()

        contact.last_login = datetime.now(UTC)
        self.db.commit()

        token = create_access_token(
            subject=str(contact.id),
            extra_claims={"type": "client", "client_id": str(contact.client_id)},
        )
        return ClientTokenResponse(access_token=token)
    def list_clients(self, firm_id):
        return self.repository.list_by_firm(firm_id)
    def resend_invite(self, email: str, firm_id):
        contact = self.repository.get_contact_by_email(email)
        if not contact:
            raise ContactNotFound()  # new exception, see below

        client = self.repository.get_client_by_id(contact.client_id)
        if not client or str(client.firm_id) != str(firm_id):
            raise ContactNotFound()  # don't reveal cross-firm existence

        if contact.invitation_status == "accepted":
            raise InviteAlreadyAccepted()

        new_token = secrets.token_urlsafe(32)
        new_expiry = datetime.now(UTC) + timedelta(hours=48)
        self.repository.update_invite_token(contact, new_token, new_expiry)
        self.db.commit()

        invite_link = f"https://yourapp.com/accept-invite?token={new_token}"
        print(f"[STUB EMAIL] Resent invitation for {contact.email}: {invite_link}")

        return contact