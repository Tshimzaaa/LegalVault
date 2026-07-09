from fastapi import FastAPI, HTTPException

from app.exceptions.auth import (
    InvalidCredentials,
    LawFirmAlreadyExists,
    UserAlreadyExists,
    InactiveUser,
)
from app.exceptions.clients import (
    ClientNotFound,
    ContactAlreadyExists,
    InvalidOrExpiredInvite,
    InviteAlreadyAccepted,
    InvalidClientCredentials,
    InactiveContact,
)


def register_exception_handlers(app: FastAPI):

    @app.exception_handler(LawFirmAlreadyExists)
    async def law_firm_exists(_, __):
        raise HTTPException(
            status_code=409,
            detail="A law firm with this email already exists.",
        )

    @app.exception_handler(UserAlreadyExists)
    async def user_exists(_, __):
        raise HTTPException(
            status_code=409,
            detail="A user with this email already exists.",
        )

    @app.exception_handler(InvalidCredentials)
    async def invalid_credentials(_, __):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
        )

    @app.exception_handler(InactiveUser)
    async def inactive_user(_, __):
        raise HTTPException(
            status_code=403,
            detail="This account has been deactivated.",
        )

    @app.exception_handler(ClientNotFound)
    async def client_not_found(_, __):
        raise HTTPException(
            status_code=404,
            detail="Client not found.",
        )

    @app.exception_handler(ContactAlreadyExists)
    async def contact_exists(_, __):
        raise HTTPException(
            status_code=409,
            detail="A contact with this email already exists.",
        )

    @app.exception_handler(InvalidOrExpiredInvite)
    async def invalid_invite(_, __):
        raise HTTPException(
            status_code=400,
            detail="This invitation link is invalid or has expired.",
        )

    @app.exception_handler(InviteAlreadyAccepted)
    async def invite_already_accepted(_, __):
        raise HTTPException(
            status_code=409,
            detail="This invitation has already been used.",
        )

    @app.exception_handler(InvalidClientCredentials)
    async def invalid_client_credentials(_, __):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
        )

    @app.exception_handler(InactiveContact)
    async def inactive_contact(_, __):
        raise HTTPException(
            status_code=403,
            detail="This account has been deactivated.",
        )