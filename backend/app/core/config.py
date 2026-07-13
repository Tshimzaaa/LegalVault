import sys
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str

    SECRET_KEY: str
    ALGORITHM: str = "HS256"

    ACCESS_TOKEN_EXPIRE_MINUTES: int

    R2_ACCESS_KEY_ID: str
    R2_SECRET_ACCESS_KEY: str
    R2_ENDPOINT_URL: str
    R2_BUCKET_NAME: str

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )
    ENVIRONMENT: str = "development"

settings = Settings()
if settings.ENVIRONMENT == "production" and settings.SECRET_KEY == "your-long-random-secret":
    sys.exit("SECRET_KEY must be changed before running in production.")