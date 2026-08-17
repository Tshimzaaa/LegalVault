import hmac
from urllib.parse import urlsplit

import httpx
from documenso_sdk import Documenso

from app.core.config import settings
from app.core.circuit_breaker import CircuitBreaker, CircuitOpenError
from app.exceptions.signatures import SigningProviderUnavailable

# Trips after repeated Documenso failures/timeouts so a provider outage fails fast
# instead of hanging every "send for signature" request — mirrors the breakers already
# used for R2 (app/core/storage.py) and ClamAV (app/core/malware_scan.py).
_breaker = CircuitBreaker(failure_threshold=5, recovery_timeout_seconds=30.0)

# Documenso requires at least one signature-field placement per signer, but there's no
# UI yet for staff to pick where on the page it goes — every signer gets the same fixed
# spot near the bottom of page 1. Revisit once field placement is exposed in the UI.
_DEFAULT_SIGNATURE_FIELD = {"pageNumber": 1, "pageX": 70, "pageY": 85, "width": 20, "height": 6}

# Documenso's webhook delivery isn't covered by its official SDK, so this header name
# (and the event-type constants in app/modules/signatures/routes.py) are our best
# understanding rather than something verified against a live instance — confirm both
# against Settings -> Webhooks on the running instance before relying on this in
# production.
WEBHOOK_SECRET_HEADER = "X-Documenso-Secret"


def _client() -> Documenso:
    return Documenso(api_key=settings.DOCUMENSO_API_KEY, server_url=settings.DOCUMENSO_API_URL)


def _signing_base_url() -> str:
    # DOCUMENSO_API_URL is the API root (e.g. ".../api/v2"); the signer-facing web app
    # lives at the same host without the API suffix.
    parts = urlsplit(settings.DOCUMENSO_API_URL)
    return f"{parts.scheme}://{parts.netloc}"


def _call_through_breaker(func):
    try:
        return _breaker.call(func)
    except CircuitOpenError as exc:
        raise SigningProviderUnavailable(
            "The e-signature service is temporarily unavailable — please try again shortly."
        ) from exc
    except SigningProviderUnavailable:
        raise
    except Exception as exc:
        raise SigningProviderUnavailable("The e-signature service request failed.") from exc


def create_and_send_document(title: str, file_bytes: bytes, recipients: list[dict]) -> dict:
    """Uploads file_bytes to Documenso, registers it with the given recipients, and
    sends it out for signature in one call.

    recipients: [{"name": str, "email": str}, ...] in the order they should sign.
    Returns {"documenso_document_id": str, "recipients": [{"email", "documenso_recipient_id", "signing_url"}]}.
    """

    def _do():
        with _client() as documenso:
            created = documenso.documents.create_v0(
                title=title,
                recipients=[
                    {
                        "email": recipient["email"],
                        "name": recipient["name"],
                        "role": "SIGNER",
                        "signingOrder": index + 1,
                        "fields": [{"type": "SIGNATURE", **_DEFAULT_SIGNATURE_FIELD}],
                    }
                    for index, recipient in enumerate(recipients)
                ],
            )

            upload_response = httpx.put(
                created.upload_url,
                content=file_bytes,
                headers={"Content-Type": "application/octet-stream"},
                timeout=30.0,
            )
            upload_response.raise_for_status()

            documenso.documents.distribute(document_id=created.document.id)

            return {
                "documenso_document_id": str(created.document.id),
                "recipients": [
                    {
                        "email": recipient.email,
                        "documenso_recipient_id": str(recipient.id),
                        "signing_url": f"{_signing_base_url()}/sign/{recipient.token}",
                    }
                    for recipient in created.document.recipients
                ],
            }

    return _call_through_breaker(_do)


def void_document(documenso_document_id: str) -> None:
    def _do():
        with _client() as documenso:
            documenso.documents.delete(document_id=float(documenso_document_id))

    _call_through_breaker(_do)


def download_completed_document(documenso_document_id: str) -> bytes:
    def _do():
        with _client() as documenso:
            response = documenso.documents.download(document_id=float(documenso_document_id))
            result = response.result
            if isinstance(result, (bytes, bytearray)):
                return bytes(result)
            if isinstance(result, str):
                # Some deployments return a signed download URL instead of raw bytes.
                fetched = httpx.get(result, timeout=30.0)
                fetched.raise_for_status()
                return fetched.content
            raise SigningProviderUnavailable("Unexpected response shape from the e-signature service.")

    return _call_through_breaker(_do)


def verify_webhook_secret(header_value: str | None) -> bool:
    if not header_value:
        return False
    return hmac.compare_digest(header_value, settings.DOCUMENSO_WEBHOOK_SECRET)
