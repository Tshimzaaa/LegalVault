"""
Covers the signature-request HTTP endpoints (app/modules/signatures/routes.py):
sending a document for signature, listing requests for a matter, voiding one, and
each portal's "pending signatures assigned to me" inbox. The Documenso webhook
handlers themselves are covered separately in test_signatures_webhook.py.
"""
import uuid

import pytest

from app.modules.auth.models.role import UserRole
from app.modules.matters.models import MatterDocument
from tests.conftest import auth_headers, make_client_company, make_contact, make_firm, make_matter, make_staff


@pytest.fixture(autouse=True)
def _stub_documenso_and_storage(monkeypatch):
    monkeypatch.setattr("app.modules.signatures.service.download_file", lambda *a, **k: b"fake pdf bytes")

    def _fake_create_and_send(title, file_bytes, recipients):
        return {
            "documenso_document_id": str(uuid.uuid4().int)[:8],
            "recipients": [
                {
                    "email": r["email"],
                    "documenso_recipient_id": str(uuid.uuid4().int)[:8],
                    "signing_url": f"http://localhost:3000/sign/{uuid.uuid4().hex}",
                }
                for r in recipients
            ],
        }

    monkeypatch.setattr("app.core.documenso_client.create_and_send_document", _fake_create_and_send)
    monkeypatch.setattr("app.core.documenso_client.void_document", lambda *a, **k: None)


def _make_document(db_session, matter, admin):
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
    db_session.commit()
    return document


def test_staff_sends_document_for_signature_to_client_and_staff_recipients(client, db_session):
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    lawyer, _ = make_staff(db_session, firm, role=UserRole.LAWYER)
    client_company = make_client_company(db_session, firm)
    contact, _ = make_contact(db_session, client_company)
    matter = make_matter(db_session, firm, client_company)
    document = _make_document(db_session, matter, admin)

    res = client.post(
        f"/matters/{matter.id}/signatures",
        json={
            "source_document_id": str(document.id),
            "title": "Please sign: Engagement Letter",
            "recipients": [
                {"recipient_type": "client_contact", "recipient_id": str(contact.id)},
                {"recipient_type": "staff", "recipient_id": str(lawyer.id)},
            ],
        },
        headers=auth_headers(admin),
    )
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "pending"
    assert len(body["recipients"]) == 2
    assert all(r["signing_url"] for r in body["recipients"])

    list_res = client.get(f"/matters/{matter.id}/signatures", headers=auth_headers(admin))
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1


def test_non_case_work_role_cannot_send_for_signature(client, db_session):
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    secretary, _ = make_staff(db_session, firm, role=UserRole.SECRETARY)
    client_company = make_client_company(db_session, firm)
    contact, _ = make_contact(db_session, client_company)
    matter = make_matter(db_session, firm, client_company)
    document = _make_document(db_session, matter, admin)

    res = client.post(
        f"/matters/{matter.id}/signatures",
        json={
            "source_document_id": str(document.id),
            "title": "Please sign",
            "recipients": [{"recipient_type": "client_contact", "recipient_id": str(contact.id)}],
        },
        headers=auth_headers(secretary),
    )
    assert res.status_code == 403


def test_staff_voids_a_pending_signature_request(client, db_session):
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    client_company = make_client_company(db_session, firm)
    contact, _ = make_contact(db_session, client_company)
    matter = make_matter(db_session, firm, client_company)
    document = _make_document(db_session, matter, admin)

    request_id = client.post(
        f"/matters/{matter.id}/signatures",
        json={
            "source_document_id": str(document.id),
            "title": "Please sign",
            "recipients": [{"recipient_type": "client_contact", "recipient_id": str(contact.id)}],
        },
        headers=auth_headers(admin),
    ).json()["id"]

    void_res = client.post(f"/matters/{matter.id}/signatures/{request_id}/void", headers=auth_headers(admin))
    assert void_res.status_code == 200
    assert void_res.json()["status"] == "voided"


def test_client_and_staff_recipients_see_their_own_pending_signatures(client, db_session):
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    lawyer, _ = make_staff(db_session, firm, role=UserRole.LAWYER)
    client_company = make_client_company(db_session, firm)
    contact, _ = make_contact(db_session, client_company)
    matter = make_matter(db_session, firm, client_company)
    document = _make_document(db_session, matter, admin)

    client.post(
        f"/matters/{matter.id}/signatures",
        json={
            "source_document_id": str(document.id),
            "title": "Please sign: Engagement Letter",
            "recipients": [
                {"recipient_type": "client_contact", "recipient_id": str(contact.id)},
                {"recipient_type": "staff", "recipient_id": str(lawyer.id)},
            ],
        },
        headers=auth_headers(admin),
    )

    client_pending = client.get("/client-signatures", headers=auth_headers(contact))
    assert client_pending.status_code == 200
    assert len(client_pending.json()) == 1

    staff_pending = client.get("/signatures/mine", headers=auth_headers(lawyer))
    assert staff_pending.status_code == 200
    assert len(staff_pending.json()) == 1

    # The admin who sent it isn't a recipient, so it shouldn't show up in their own inbox.
    admin_pending = client.get("/signatures/mine", headers=auth_headers(admin))
    assert admin_pending.status_code == 200
    assert admin_pending.json() == []
