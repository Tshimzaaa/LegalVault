from fastapi import FastAPI

from app.core.exception_handlers import register_exception_handlers
from app.modules.auth.routes import router as auth_router 

from fastapi.middleware.cors import CORSMiddleware



app = FastAPI(
    title="LegalHub API",
    version="1.0.0",
    description="Backend API for the LegalHub Legal Practice Management System",
)
app.include_router(auth_router)
# Register global exception handlers
register_exception_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # his dev URL, and later your real domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.get("/")
def root():
    return {
        "message": "Welcome to the LegalHub API",
        "status": "running",
    }