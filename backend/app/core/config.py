import sys
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str

    SECRET_KEY: str
    ALGORITHM: str = "HS256"

    ACCESS_TOKEN_EXPIRE_MINUTES: int
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    R2_ACCESS_KEY_ID: str
    R2_SECRET_ACCESS_KEY: str
    R2_ENDPOINT_URL: str
    R2_BUCKET_NAME: str

    ENVIRONMENT: str = "development"
    REGISTER_SECRET: str = "change-me"

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