import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.gzip import GZipMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.config import settings
from app.core.limiter import limiter
from app.core.exception_handlers import register_exception_handlers
from app.modules.auth.routes import router as auth_router

# Skipped entirely when unset — see SENTRY_DSN's docstring in core/config.py. FastAPI/
# Starlette/SQLAlchemy get auto-instrumented once this runs, no manual integration
# wiring needed. send_default_pii stays False: this platform holds client legal data,
# nothing request-body/PII-shaped goes to a third party by default. No performance
# tracing (traces_sample_rate=0) — scope here is error tracking, not APM.
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENVIRONMENT,
        send_default_pii=False,
        traces_sample_rate=0.0,
    )

from fastapi.middleware.cors import CORSMiddleware
from app.modules.templates.routes import router as templates_router, client_templates_router
from app.modules.matters.routes import router as matters_router, client_matters_router
from app.modules.clients.routes import router as clients_router, client_auth_router
from app.modules.owner.routes import router as owner_router
from app.modules.dashboard.routes import router as dashboard_router
from app.modules.client_dashboard.routes import router as client_dashboard_router
from app.modules.search.routes import router as search_router
from app.modules.audit.routes import router as audit_router
from app.modules.announcements.routes import (
    router as announcements_router,
    owner_announcements_router,
    client_announcements_router,
)
from app.modules.monitoring.middleware import log_requests
from app.modules.notifications.routes import router as notifications_router, client_notifications_router
from app.modules.reporting.routes import router as reporting_router
from app.modules.signed_contracts.routes import (
    router as signed_contracts_router,
    client_signed_contracts_router,
)
from app.modules.intake.routes import (
    router as intake_forms_router,
    submissions_router as intake_submissions_router,
    client_intake_router,
)
from app.modules.knowledge.routes import router as knowledge_router, client_knowledge_router
from app.modules.integrations.routes import router as integrations_router
from app.modules.signatures.routes import (
    router as signatures_router,
    my_signatures_router,
    client_signatures_router,
    webhook_router as documenso_webhook_router,
)

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
app.include_router(client_dashboard_router)
app.include_router(search_router)
app.include_router(audit_router)
app.include_router(announcements_router)
app.include_router(owner_announcements_router)
app.include_router(client_announcements_router)
app.include_router(notifications_router)
app.include_router(client_notifications_router)
app.include_router(reporting_router)
app.include_router(signed_contracts_router)
app.include_router(client_signed_contracts_router)
app.include_router(intake_forms_router)
app.include_router(intake_submissions_router)
app.include_router(client_intake_router)
app.include_router(knowledge_router)
app.include_router(client_knowledge_router)
app.include_router(integrations_router)
app.include_router(signatures_router)
app.include_router(my_signatures_router)
app.include_router(client_signatures_router)
app.include_router(documenso_webhook_router)

# Register global exception handlers
register_exception_handlers(app)

# In production this must be the deployed frontend's real origin (see config.py's
# startup check) — the local dev origin is only added when not running in production,
# so a misconfigured deploy can't silently fall back to trusting localhost.
_allowed_origins = [settings.FRONTEND_URL]
if settings.ENVIRONMENT != "production" and "http://localhost:5173" not in _allowed_origins:
    _allowed_origins.append("http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

app.middleware("http")(log_requests)


@app.middleware("http")
async def add_hsts_header(request: Request, call_next):
    response = await call_next(request)
    # Only meaningful (and only sent) once the app is actually served over HTTPS —
    # sending it over plain HTTP in local dev would be a no-op at best and confusing
    # at worst, so it's gated on ENVIRONMENT rather than always-on.
    if settings.ENVIRONMENT == "production":
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
    return response


@app.get("/")
def root():
    return {
        "message": "Welcome to the LegalHub API",
        "status": "running",
    }