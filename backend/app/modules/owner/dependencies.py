# app/modules/owner/dependencies.py
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.database.rls import set_tenant_context
from app.core.security import decode_access_token

owner_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="owner/login")


def get_current_owner(token: str = Depends(owner_oauth2_scheme), db: Session = Depends(get_db)):
    payload = decode_access_token(token)
    if not payload or payload.get("type") != "owner":
        raise HTTPException(status_code=401, detail="Invalid or missing owner credentials.")

    # The owner console is intentionally cross-org — is_owner=True makes the RLS
    # policies (see the add_row_level_security migration) permit every row instead
    # of scoping to a single org_id.
    set_tenant_context(db, org_id=None, is_owner=True)

    return True