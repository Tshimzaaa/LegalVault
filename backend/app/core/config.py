import sys
from cryptography.fernet import Fernet
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # The migration-time connection — must be a role that owns the tables (so
    # alembic can ALTER TABLE / CREATE POLICY etc).
    DATABASE_URL: str

    # The app's actual request-serving connection. Row-level security (see the
    # add_row_level_security migration) only applies to roles without the
    # BYPASSRLS attribute — table-owning roles (including Neon's default
    # "<project>_owner" role) typically have it, which makes RLS policies
    # silently inert for them regardless of FORCE ROW LEVEL SECURITY. This must
    # be a separate, least-privilege role (see backend/docs/architecture.md for
    # the exact CREATE ROLE / GRANT statements). Falls back to DATABASE_URL so
    # existing .env files keep working — but RLS has no real effect until this
    # is set to a proper restricted role.
    RUNTIME_DATABASE_URL: str | None = None

    SECRET_KEY: str
    ALGORITHM: str = "HS256"

    ACCESS_TOKEN_EXPIRE_MINUTES: int
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # The deployed frontend origin CORS should trust in production. Defaults to the
    # local Vite dev server so existing .env files keep working unchanged; deployments
    # must set this to the real frontend URL (see main.py's CORS setup).
    FRONTEND_URL: str = "http://localhost:5173"

    R2_ACCESS_KEY_ID: str
    R2_SECRET_ACCESS_KEY: str
    R2_ENDPOINT_URL: str
    R2_BUCKET_NAME: str

    # ClamAV daemon for malware-scanning uploads — see docker-compose.yml for local
    # dev; in production this points at a private-network ClamAV service.
    CLAMD_HOST: str = "localhost"
    CLAMD_PORT: int = 3310

    ENVIRONMENT: str = "development"
    REGISTER_SECRET: str = "change-me"
    OWNER_SECRET: str = "change-me"

    # Fernet key used to encrypt third-party integration credentials at rest
    # (see app/core/encryption.py). Required in every environment, including
    # dev, so a missing key fails loudly at startup rather than as a confusing
    # base64-decode error the first time something is encrypted. Generate with:
    #   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    ENCRYPTION_KEY: str

    # Self-hosted Documenso instance (e-signature) shared by every firm on the
    # platform — see docker-compose.yml's `documenso` service for local dev.
    # Firms never see or configure these; it's a platform-level dependency,
    # not a per-firm integration (unlike app/modules/integrations).
    DOCUMENSO_API_URL: str = "http://localhost:3000/api/v1"
    DOCUMENSO_API_KEY: str = "change-me"

    # Shared secret Documenso signs its webhook payloads with (HMAC-SHA256 over
    # the raw request body) — see app/modules/signatures/routes.py's webhook
    # handler. Configured on the Documenso side as the webhook's "secret".
    DOCUMENSO_WEBHOOK_SECRET: str = "change-me"

    # Celery broker for background jobs (matter due-date / contract expiry reminders —
    # see app/tasks/). See docker-compose.yml's `redis` service for local dev.
    REDIS_URL: str = "redis://localhost:6379/0"

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )


settings = Settings()

if settings.ENVIRONMENT == "production":
    if settings.SECRET_KEY in ("your-long-random-secret", "change-me", ""):
        sys.exit("SECRET_KEY must be set to a real random value before running in production.")
    if settings.REGISTER_SECRET in ("change-me", ""):
        sys.exit("REGISTER_SECRET must be set before running in production.")
    if settings.OWNER_SECRET in ("change-me", ""):
        sys.exit("OWNER_SECRET must be set before running in production.")
    if settings.OWNER_SECRET == settings.REGISTER_SECRET:
        sys.exit("OWNER_SECRET must differ from REGISTER_SECRET — sharing one secret between firm "
                  "self-registration and full platform owner access lets anyone with the registration "
                  "secret export or delete every firm's data.")
    if settings.FRONTEND_URL == "http://localhost:5173":
        sys.exit("FRONTEND_URL must be set to the deployed frontend's real origin before running in "
                  "production — otherwise CORS falls back to a dev-only origin and the deployed "
                  "frontend won't be able to call the API at all.")
    if settings.RUNTIME_DATABASE_URL is None:
        sys.exit("RUNTIME_DATABASE_URL must be set before running in production — without it the app "
                  "connects as the table-owning (BYPASSRLS) role and the row-level-security policies "
                  "silently have no effect. See backend/docs/architecture.md for the role setup.")
    if settings.ENCRYPTION_KEY in ("change-me", ""):
        sys.exit("ENCRYPTION_KEY must be set to a real Fernet key before running in production.")
    if settings.DOCUMENSO_API_KEY in ("change-me", ""):
        sys.exit("DOCUMENSO_API_KEY must be set before running in production.")
    if settings.DOCUMENSO_WEBHOOK_SECRET in ("change-me", ""):
        sys.exit("DOCUMENSO_WEBHOOK_SECRET must be set before running in production — without it, "
                  "incoming webhook requests can't be verified and anyone could forge a "
                  "'document completed' event.")
    if settings.REDIS_URL == "redis://localhost:6379/0":
        sys.exit("REDIS_URL must be set to a real Redis instance before running in production — "
                  "background jobs (matter/contract reminders) have no broker to run against "
                  "otherwise.")
    try:
        Fernet(settings.ENCRYPTION_KEY.encode())
    except Exception:
        sys.exit("ENCRYPTION_KEY must be a valid urlsafe-base64-encoded 32-byte key "
                  "(generate with Fernet.generate_key()).")