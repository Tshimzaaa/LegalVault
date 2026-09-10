import hmac
from urllib.parse import urlsplit

import httpx

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
_DEFAULT_SIGNATURE_FIELD = {"pageNumber": 1, "pageX": 70, "pageY": 85, "pageWidth": 20, "pageHeight": 6}

# Documenso's webhook delivery isn't covered by its official SDK, so this header name
# (and the event-type constants in app/modules/signatures/routes.py) are our best
# understanding rather than something verified against a live instance — confirm both
# against Settings -> Webhooks on the running instance before relying on this in
# production.
WEBHOOK_SECRET_HEADER = "X-Documenso-Secret"

# The documenso_sdk package (pinned at 0.6.0, the latest release on PyPI) targets an
# older generation of Documenso's API (singular "/document/*" paths, e.g.
# "/document/create/beta") that no longer exists on the self-hosted image this project
# runs (docker-compose.yml pulls "documenso/documenso:latest", which exposes a
# different "/api/v1/documents" REST surface — confirmed against that image's own
# OpenAPI spec at /api/v1/openapi.json). Calling the SDK's document methods against a
# real instance 404s. Talking to the REST API directly with httpx avoids depending on
# an SDK that's drifted out of sync with the product it wraps.


def _api_headers() -> dict:
    return {"Authorization": f"Bearer {settings.DOCUMENSO_API_KEY}"}


def _signing_base_url() -> str:
    # DOCUMENSO_API_URL is the API root (e.g. "http://localhost:3000/api/v1"); the
    # signer-facing web app lives at the same host without the API suffix.
    parts = urlsplit(settings.DOCUMENSO_API_URL)
    return f"{parts.scheme}://{parts.netloc}"


def _call_through_breaker(func):
    try:
        return _breaker.call(func)
    except CircuitOpenError as exc:
        raise SigningProviderUnavailable(
            "The e-signature service is temporarily unavailable, please try again shortly."
        ) from exc
    except SigningProviderUnavailable:
        raise
    except Exception as exc:
        raise SigningProviderUnavailable("The e-signature service request failed.") from exc


def create_and_send_document(title: str, file_bytes: bytes, recipients: list[dict]) -> dict:
    """Uploads file_bytes to Documenso, registers it with the given recipients, places
    a signature field for each, and sends it out for signature.

    recipients: [{"name": str, "email": str}, ...] in the order they should sign.
    Returns {"documenso_document_id": str, "recipients": [{"email", "documenso_recipient_id", "signing_url"}]}.
    """

    def _do():
        with httpx.Client(base_url=settings.DOCUMENSO_API_URL, headers=_api_headers(), timeout=30.0) as client:
            create_response = client.post(
                "/documents",
                json={
                    "title": title,
                    "recipients": [
                        {
                            "email": recipient["email"],
                            "name": recipient["name"],
                            "role": "SIGNER",
                            "signingOrder": index + 1,
                        }
                        for index, recipient in enumerate(recipients)
                    ],
                },
            )
            create_response.raise_for_status()
            created = create_response.json()

            upload_response = httpx.put(
                created["uploadUrl"],
                content=file_bytes,
                headers={"Content-Type": "application/octet-stream"},
                timeout=30.0,
            )
            upload_response.raise_for_status()

            document_id = created["documentId"]
            for recipient in created["recipients"]:
                field_response = client.post(
                    f"/documents/{document_id}/fields",
                    json={
                        "recipientId": recipient["recipientId"],
                        "type": "SIGNATURE",
                        **_DEFAULT_SIGNATURE_FIELD,
                    },
                )
                field_response.raise_for_status()

            # No SMTP is configured for local/self-hosted Documenso (see
            # docker-compose.yml), so asking it to email recipients would just fail
            # silently — send without email and rely on the signing_url below instead.
            send_response = client.post(f"/documents/{document_id}/send", json={"sendEmail": False})
            send_response.raise_for_status()

            return {
                "documenso_document_id": str(document_id),
                "recipients": [
                    {
                        "email": recipient["email"],
                        "documenso_recipient_id": str(recipient["recipientId"]),
                        "signing_url": f"{_signing_base_url()}/sign/{recipient['token']}",
                    }
                    for recipient in created["recipients"]
                ],
            }

    return _call_through_breaker(_do)


def void_document(documenso_document_id: str) -> None:
    def _do():
        with httpx.Client(base_url=settings.DOCUMENSO_API_URL, headers=_api_headers(), timeout=30.0) as client:
            response = client.delete(f"/documents/{documenso_document_id}")
            response.raise_for_status()

    _call_through_breaker(_do)


def download_completed_document(documenso_document_id: str) -> bytes:
    def _do():
        with httpx.Client(base_url=settings.DOCUMENSO_API_URL, headers=_api_headers(), timeout=30.0) as client:
            response = client.get(f"/documents/{documenso_document_id}/download")
            response.raise_for_status()
            download_url = response.json()["downloadUrl"]

        fetched = httpx.get(download_url, timeout=30.0)
        fetched.raise_for_status()
        return fetched.content

    return _call_through_breaker(_do)


def verify_webhook_secret(header_value: str | None) -> bool:
    if not header_value:
        return False
    return hmac.compare_digest(header_value, settings.DOCUMENSO_WEBHOOK_SECRET)
