import boto3
from botocore.client import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import settings
from app.core.circuit_breaker import CircuitBreaker, CircuitOpenError
from app.exceptions.storage import StorageUnavailable

# Bounds how long a single R2 call can block a request thread — boto3's default timeouts
# (60s connect / 60s read) are long enough that a handful of stuck uploads could exhaust the
# threadpool FastAPI's sync routes run on, stalling unrelated requests.
_R2_CLIENT_CONFIG = Config(
    signature_version="s3v4",
    connect_timeout=5,
    read_timeout=10,
    retries={"max_attempts": 2},
)

# Trips after repeated R2 failures/timeouts so further calls fail fast instead of queuing up
# behind an already-unhealthy dependency; recovers automatically after the cooldown.
_storage_breaker = CircuitBreaker(failure_threshold=5, recovery_timeout_seconds=30.0)


def get_r2_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.R2_ENDPOINT_URL,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=_R2_CLIENT_CONFIG,
        region_name="auto",
    )


def _call_through_breaker(func, *args, **kwargs):
    try:
        return _storage_breaker.call(func, *args, **kwargs)
    except CircuitOpenError:
        raise StorageUnavailable("File storage is temporarily unavailable — please try again shortly.")
    except (BotoCoreError, ClientError) as exc:
        raise StorageUnavailable("File storage request failed.") from exc


def upload_file(file_bytes: bytes, key: str, content_type: str) -> str:
    def _do_upload():
        get_r2_client().put_object(
            Bucket=settings.R2_BUCKET_NAME,
            Key=key,
            Body=file_bytes,
            ContentType=content_type,
        )
        return key

    return _call_through_breaker(_do_upload)


def get_download_url(key: str, expires_in: int = 3600) -> str:
    # Presigned URLs are computed locally (no network round trip to R2), so this doesn't go
    # through the circuit breaker — there's nothing here that can hang or fail on R2's end.
    client = get_r2_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.R2_BUCKET_NAME, "Key": key},
        ExpiresIn=expires_in,
    )


def delete_file(key: str) -> None:
    def _do_delete():
        get_r2_client().delete_object(Bucket=settings.R2_BUCKET_NAME, Key=key)

    _call_through_breaker(_do_delete)