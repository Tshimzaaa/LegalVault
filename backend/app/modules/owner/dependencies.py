# app/modules/owner/dependencies.py
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from app.core.security import decode_access_token

owner_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="owner/login")


def get_current_owner(token: str = Depends(owner_oauth2_scheme)):
    payload = decode_access_token(token)
    if not payload or payload.get("type") != "owner":
        raise HTTPException(status_code=401, detail="Invalid or missing owner credentials.")
    return True