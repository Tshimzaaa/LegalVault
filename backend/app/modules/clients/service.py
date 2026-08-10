import secrets
from datetime import datetime,timedelta, UTC
from sqlalchemy.orm import Session
import secrets as _secrets  # or reuse existing `secrets` import if already there
from app.exceptions.clients import InvalidOrExpiredResetToken
from app.modules.clients.repository import ClientRepository
from app.modules.clients.models import Client, ClientContact
from app.modules.clients.schemas import (
    CreateClientRequest,
    InviteContactRequest,
    AcceptInviteRequest,
    ClientLoginRequest,
    ClientTokenResponse,
    UpdateContactProfileRequest,
    ChangeContactPasswordRequest,
)
from app.core.config import settings
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    generate_refresh_token,
    hash_refresh_token,
)
from app.modules.auth.refresh_token_repository import RefreshTokenRepository
from app.modules.auth.models.refresh_token import RefreshTokenActorType
from app.exceptions.clients import (
    ClientNotFound,
    ContactAlreadyExists,
    InvalidOrExpiredInvite,
    InviteAlreadyAccepted,
    InvalidClientCredentials,
    InactiveContact,
    ContactNotFound,
    ClientHasMatters,
    InvalidRefreshToken,
    IncorrectPassword,
)
from app.modules.matters.repository import MatterRepository
from app.modules.audit.service import AuditService
from app.modules.audit.models import ActorType
from app.modules.audit import actions as audit_actions

RESET_TOKEN_EXPIRY_HOURS = 1


class ClientService:
    def __init__(self, db: Session):
        self.db = db
        self.repository = ClientRepository(db)
        self.audit = AuditService(db)
        self.refresh_tokens = RefreshTokenRepository(db)

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

        raw_refresh_token = generate_refresh_token()
        self.refresh_tokens.create(
            actor_type=RefreshTokenActorType.CLIENT,
            actor_id=contact.id,
            token_hash=hash_refresh_token(raw_refresh_token),
            expires_at=datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )
        self.db.commit()

        token = create_access_token(
            subject=str(contact.id),
            extra_claims={"type": "client", "client_id": str(contact.client_id)},
        )
        return ClientTokenResponse(access_token=token, refresh_token=raw_refresh_token)

    def refresh_token(self, raw_refresh_token: str) -> ClientTokenResponse:
        record = self.refresh_tokens.get_valid_by_hash(
            hash_refresh_token(raw_refresh_token), RefreshTokenActorType.CLIENT
        )
        if not record:
            raise InvalidRefreshToken()

        contact = self.repository.get_contact_by_id(record.actor_id)
        if not contact or not contact.is_active:
            raise InactiveContact()

        # Rotate: the old token is single-use, so a leaked/replayed token can't be reused.
        self.refresh_tokens.revoke(record)
        raw_new_refresh_token = generate_refresh_token()
        self.refresh_tokens.create(
            actor_type=RefreshTokenActorType.CLIENT,
            actor_id=contact.id,
            token_hash=hash_refresh_token(raw_new_refresh_token),
            expires_at=datetime.now(UTC) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        )
        self.db.commit()

        access_token = create_access_token(
            subject=str(contact.id),
            extra_claims={"type": "client", "client_id": str(contact.client_id)},
        )
        return ClientTokenResponse(access_token=access_token, refresh_token=raw_new_refresh_token)

    def logout(self, raw_refresh_token: str) -> None:
        record = self.refresh_tokens.get_valid_by_hash(
            hash_refresh_token(raw_refresh_token), RefreshTokenActorType.CLIENT
        )
        if record:
            self.refresh_tokens.revoke(record)
            self.db.commit()

    def list_clients(self, firm_id):
        return self.repository.list_by_firm(firm_id)

    def list_contacts(self, client_id, firm_id):
        client = self.repository.get_client_by_id(client_id)
        if not client or str(client.firm_id) != str(firm_id):
            raise ClientNotFound()
        return self.repository.list_contacts_for_client(client_id)
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
    def request_password_reset(self, email: str):
        contact = self.repository.get_contact_by_email(email)
        if not contact:
            return  # don't reveal existence

        token = _secrets.token_urlsafe(32)
        expires_at = datetime.now(UTC) + timedelta(hours=RESET_TOKEN_EXPIRY_HOURS)
        self.repository.set_reset_token(contact, token, expires_at)
        self.db.commit()

        reset_link = f"https://yourapp.com/client-reset-password?token={token}"
        print(f"[STUB EMAIL] Password reset for {contact.email}: {reset_link}")

    def reset_password(self, token: str, new_password: str):
        contact = self.repository.get_contact_by_reset_token(token)
        if not contact or not contact.reset_token_expires_at or contact.reset_token_expires_at < datetime.now(UTC):
            raise InvalidOrExpiredResetToken()

        contact.password_hash = hash_password(new_password)
        self.repository.clear_reset_token(contact)
        self.refresh_tokens.revoke_all_for_actor(RefreshTokenActorType.CLIENT, contact.id)
        self.db.commit()

    def update_profile(self, contact: ClientContact, request: UpdateContactProfileRequest) -> ClientContact:
        if request.email != contact.email:
            existing = self.repository.get_contact_by_email(request.email)
            if existing and str(existing.id) != str(contact.id):
                raise ContactAlreadyExists()
            contact.email = request.email

        contact.first_name = request.first_name
        contact.last_name = request.last_name
        self.db.commit()
        return contact

    def change_password(self, contact: ClientContact, request: ChangeContactPasswordRequest) -> None:
        if not contact.password_hash or not verify_password(request.current_password, contact.password_hash):
            raise IncorrectPassword()

        contact.password_hash = hash_password(request.new_password)
        # Revoke every other session so a change made after a suspected compromise actually locks
        # out anyone using the old password's refresh token — only this login stays valid.
        self.refresh_tokens.revoke_all_for_actor(RefreshTokenActorType.CLIENT, contact.id)
        self.db.commit()

    def update_client_status(self, client_id, firm_id, actor_id, is_active: bool) -> Client:
        client = self.repository.get_client_by_id(client_id)
        if not client or str(client.firm_id) != str(firm_id):
            raise ClientNotFound()

        client.is_active = is_active

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            firm_id=firm_id,
            action=audit_actions.CLIENT_STATUS_UPDATED,
            target_type="client",
            target_id=client.id,
            details={"company_name": client.company_name, "is_active": is_active},
        )
        self.db.commit()
        return client

    def delete_client(self, client_id, firm_id, actor_id):
        client = self.repository.get_client_by_id(client_id)
        if not client or str(client.firm_id) != str(firm_id):
            raise ClientNotFound()

        matter_repository = MatterRepository(self.db)
        if matter_repository.list_by_client(client_id):
            raise ClientHasMatters()

        for contact in self.repository.list_contacts_for_client(client_id):
            self.repository.delete_contact(contact)
        self.repository.delete_client(client)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            firm_id=firm_id,
            action=audit_actions.CLIENT_DELETED,
            target_type="client",
            target_id=client.id,
            details={"company_name": client.company_name},
        )
        self.db.commit()

    def update_contact_status(self, client_id, contact_id, firm_id, actor_id, is_active: bool) -> ClientContact:
        client = self.repository.get_client_by_id(client_id)
        if not client or str(client.firm_id) != str(firm_id):
            raise ClientNotFound()

        contact = self.repository.get_contact_by_id(contact_id)
        if not contact or str(contact.client_id) != str(client_id):
            raise ContactNotFound()

        contact.is_active = is_active
        if not is_active:
            self.refresh_tokens.revoke_all_for_actor(RefreshTokenActorType.CLIENT, contact.id)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            firm_id=firm_id,
            action=audit_actions.CONTACT_STATUS_UPDATED,
            target_type="client_contact",
            target_id=contact.id,
            details={"email": contact.email, "is_active": is_active},
        )
        self.db.commit()
        return contact

    def delete_contact(self, client_id, contact_id, firm_id, actor_id):
        client = self.repository.get_client_by_id(client_id)
        if not client or str(client.firm_id) != str(firm_id):
            raise ClientNotFound()

        contact = self.repository.get_contact_by_id(contact_id)
        if not contact or str(contact.client_id) != str(client_id):
            raise ContactNotFound()

        self.repository.clear_contact_document_uploads(contact_id)
        self.repository.delete_contact(contact)

        self.audit.log(
            actor_type=ActorType.STAFF,
            actor_id=actor_id,
            firm_id=firm_id,
            action=audit_actions.CONTACT_DELETED,
            target_type="client_contact",
            target_id=contact.id,
            details={"email": contact.email},
        )
        self.db.commit()