from datetime import datetime, UTC

from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.database.rls import set_tenant_context
from app.modules.clients.repository import ClientRepository
from app.core.security import decode_access_token
from app.exceptions.clients import InvalidClientCredentials, InactiveContact
from app.modules.clients.models import ClientContact

client_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="client-auth/login")


def get_current_contact(
    token: str = Depends(client_oauth2_scheme),
    db: Session = Depends(get_db),
) -> ClientContact:
    payload = decode_access_token(token)

    if not payload or payload.get("type") != "client" or "sub" not in payload or "iat" not in payload:
        raise InvalidClientCredentials()

    repo = ClientRepository(db)
    contact = repo.get_contact_by_id(payload["sub"])

    if not contact:
        raise InvalidClientCredentials()
    if not contact.is_active:
        raise InactiveContact()

    if contact.tokens_invalid_before:
        token_issued_at = datetime.fromtimestamp(payload["iat"], tz=UTC)
        if token_issued_at < contact.tokens_invalid_before:
            raise InvalidClientCredentials()

    # No tenant context is set yet at this point, and `clients` is RLS-protected,
    # so resolving the contact's firm has to briefly bypass RLS (is_owner=True)
    # before the real per-request context can be set.
    set_tenant_context(db, firm_id=None, is_owner=True)
    client = repo.get_client_by_id(contact.client_id)
    if not client:
        raise InvalidClientCredentials()
    set_tenant_context(db, firm_id=client.firm_id)

    return contact