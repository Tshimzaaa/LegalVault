"""
Covers the Documenso webhook receiver (app/modules/signatures/routes.py).

The payload shapes asserted here (a full-document payload with a `recipients` array,
each carrying its own `signingStatus` — not a top-level "recipient" object naming just
the one who acted) were confirmed on 2026-09-09 against a real running self-hosted
Documenso instance's compiled webhook-sending code, not assumed from documentation.
"""
import uuid

from app.core.config import settings
from app.core.documenso_client import WEBHOOK_SECRET_HEADER
from app.modules.matters.models import MatterDocument
from app.modules.notifications.models import RecipientType
from app.modules.signatures.models import (
    SignatureRecipient,
    SignatureRecipientStatus,
    SignatureRequest,
    SignatureRequestStatus,
)
from tests.conftest import make_client_company, make_contact, make_firm, make_matter, make_staff


def _make_signature_request(db_session, firm, client_company, matter, admin, *, documenso_document_id):
    document = MatterDocument(
        matter_id=matter.id,
        uploaded_by=admin.id,
        title="Engagement Letter",
        file_key=f"matter_documents/{matter.id}/{uuid.uuid4()}-engagement-letter.pdf",
        original_filename="engagement-letter.pdf",
        content_type="application/pdf",
    )
    db_session.add(document)
    db_session.flush()

    signature_request = SignatureRequest(
        firm_id=firm.id,
        matter_id=matter.id,
        client_id=client_company.id,
        source_document_id=document.id,
        requested_by=admin.id,
        title="Please sign: Engagement Letter",
        status=SignatureRequestStatus.PENDING,
        documenso_document_id=documenso_document_id,
    )
    db_session.add(signature_request)
    db_session.flush()

    recipient = SignatureRecipient(
        signature_request_id=signature_request.id,
        recipient_type=RecipientType.CLIENT_CONTACT,
        recipient_id=uuid.uuid4(),
        name="Mike Johnson",
        email="mike@example.com",
        signing_order=1,
        status=SignatureRecipientStatus.PENDING,
        signing_url="http://localhost:3000/sign/test-token",
        documenso_recipient_id="42",
    )
    db_session.add(recipient)
    db_session.commit()

    return signature_request, recipient


def _document_payload(documenso_document_id: str, recipients: list[dict]) -> dict:
    # Mirrors mapEnvelopeToWebhookDocumentPayload's real output shape — a full
    # document, not a single recipient.
    return {
        "event": "placeholder",  # overwritten by caller per-test
        "payload": {
            "id": int(documenso_document_id),
            "envelopeId": "env_test",
            "title": "Please sign: Engagement Letter",
            "recipients": recipients,
            "Recipient": recipients,
        },
        "createdAt": "2026-09-09T00:00:00.000Z",
        "webhookEndpoint": "http://host.docker.internal:8000/webhooks/documenso",
    }


def test_webhook_rejects_missing_or_wrong_secret(client, db_session):
    body = _document_payload("1", [])
    body["event"] = "DOCUMENT_COMPLETED"

    no_header = client.post("/webhooks/documenso", json=body)
    assert no_header.status_code == 401

    wrong_secret = client.post("/webhooks/documenso", json=body, headers={WEBHOOK_SECRET_HEADER: "not-the-secret"})
    assert wrong_secret.status_code == 401


def test_document_signed_marks_matching_recipient_signed(client, db_session):
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    client_company = make_client_company(db_session, firm)
    matter = make_matter(db_session, firm, client_company)
    signature_request, recipient = _make_signature_request(
        db_session, firm, client_company, matter, admin, documenso_document_id="101"
    )

    body = _document_payload(
        "101",
        [
            {
                "id": 42,
                "email": recipient.email,
                "name": recipient.name,
                "signingStatus": "SIGNED",
                "rejectionReason": None,
            }
        ],
    )
    body["event"] = "DOCUMENT_SIGNED"

    res = client.post("/webhooks/documenso", json=body, headers={WEBHOOK_SECRET_HEADER: settings.DOCUMENSO_WEBHOOK_SECRET})
    assert res.status_code == 200

    db_session.refresh(recipient)
    assert recipient.status == SignatureRecipientStatus.SIGNED
    assert recipient.signed_at is not None


def test_document_recipient_completed_also_marks_recipient_signed(client, db_session):
    # DOCUMENT_RECIPIENT_COMPLETED fires per-recipient-completes (before the whole
    # document is done) and carries the same full-document payload shape as
    # DOCUMENT_SIGNED — both should be handled the same way.
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    client_company = make_client_company(db_session, firm)
    matter = make_matter(db_session, firm, client_company)
    signature_request, recipient = _make_signature_request(
        db_session, firm, client_company, matter, admin, documenso_document_id="102"
    )

    body = _document_payload(
        "102",
        [{"id": 42, "email": recipient.email, "name": recipient.name, "signingStatus": "SIGNED", "rejectionReason": None}],
    )
    body["event"] = "DOCUMENT_RECIPIENT_COMPLETED"

    res = client.post("/webhooks/documenso", json=body, headers={WEBHOOK_SECRET_HEADER: settings.DOCUMENSO_WEBHOOK_SECRET})
    assert res.status_code == 200

    db_session.refresh(recipient)
    assert recipient.status == SignatureRecipientStatus.SIGNED


def test_document_rejected_marks_rejecting_recipient_declined(client, db_session):
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    client_company = make_client_company(db_session, firm)
    matter = make_matter(db_session, firm, client_company)
    signature_request, recipient = _make_signature_request(
        db_session, firm, client_company, matter, admin, documenso_document_id="103"
    )

    body = _document_payload(
        "103",
        [
            {
                "id": 42,
                "email": recipient.email,
                "name": recipient.name,
                "signingStatus": "REJECTED",
                "rejectionReason": "Wrong terms",
            }
        ],
    )
    body["event"] = "DOCUMENT_REJECTED"

    res = client.post("/webhooks/documenso", json=body, headers={WEBHOOK_SECRET_HEADER: settings.DOCUMENSO_WEBHOOK_SECRET})
    assert res.status_code == 200

    db_session.refresh(recipient)
    db_session.refresh(signature_request)
    assert recipient.status == SignatureRecipientStatus.DECLINED
    assert signature_request.status == SignatureRequestStatus.DECLINED


def test_unknown_documenso_document_id_is_ignored_not_errored(client, db_session):
    body = _document_payload(
        "999999",
        [{"id": 1, "email": "nobody@example.com", "name": "Nobody", "signingStatus": "SIGNED", "rejectionReason": None}],
    )
    body["event"] = "DOCUMENT_SIGNED"

    res = client.post("/webhooks/documenso", json=body, headers={WEBHOOK_SECRET_HEADER: settings.DOCUMENSO_WEBHOOK_SECRET})
    assert res.status_code == 200
