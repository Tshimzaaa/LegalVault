from fastapi import FastAPI

from app.core.exception_handlers import register_exception_handlers

app = FastAPI(
    title="LegalHub API",
    version="1.0.0",
    description="Backend API for the LegalHub Legal Practice Management System",
)

# Register global exception handlers
register_exception_handlers(app)


@app.get("/")
def root():
    return {
        "message": "Welcome to the LegalHub API",
        "status": "running",
    }