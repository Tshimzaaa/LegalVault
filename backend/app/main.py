from fastapi import FastAPI
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.limiter import limiter
from app.core.exception_handlers import register_exception_handlers
from app.modules.auth.routes import router as auth_router

from fastapi.middleware.cors import CORSMiddleware
from app.modules.templates.routes import router as templates_router, client_templates_router
from app.modules.matters.routes import router as matters_router, client_matters_router
from app.modules.clients.routes import router as clients_router, client_auth_router
from app.modules.owner.routes import router as owner_router
from app.modules.dashboard.routes import router as dashboard_router
from app.modules.support_requests.routes import router as support_requests_router, client_support_requests_router

app = FastAPI(
    title="LegalHub API",
    version="1.0.0",
    description="Backend API for the LegalHub Legal Practice Management System",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.include_router(client_matters_router)
app.include_router(matters_router)
app.include_router(templates_router)
app.include_router(client_templates_router)
app.include_router(clients_router)
app.include_router(client_auth_router)
app.include_router(auth_router)
app.include_router(owner_router)
app.include_router(dashboard_router)
app.include_router(support_requests_router)
app.include_router(client_support_requests_router)

# Register global exception handlers
register_exception_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
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