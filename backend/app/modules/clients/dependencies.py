from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database.session import get_db
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

    if not payload or payload.get("type") != "client" or "sub" not in payload:
        raise InvalidClientCredentials()

    repo = ClientRepository(db)
    contact = repo.get_contact_by_id(payload["sub"])

    if not contact:
        raise InvalidClientCredentials()
    if not contact.is_active:
        raise InactiveContact()

    return contact