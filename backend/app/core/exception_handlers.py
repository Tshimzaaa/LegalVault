from fastapi import FastAPI, HTTPException

from app.exceptions.auth import (
    InvalidCredentials,
    LawFirmAlreadyExists,
    UserAlreadyExists,
    InactiveUser,
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