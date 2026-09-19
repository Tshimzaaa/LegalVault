"""
Public contact / access-request submissions and the owner-only inbox for them.
Inquiries belong to no organization, so the checks that matter here are that the
public endpoint validates and stays open, and that only the owner can read or change them.

The suite runs against a shared dev database that may already hold real inquiries, so every
test identifies its own rows by a unique email and compares counts before and after.
"""
import uuid

from tests.conftest import auth_headers, make_org, make_staff, owner_headers


def _email(prefix="person"):
    return f"{prefix}-{uuid.uuid4().hex[:10]}@example.com"


def _contact(**overrides):
    body = {
        "kind": "contact",
        "name": "Thandi Mokoena",
        "email": _email("contact"),
        "message": "Do you support multi-office firms?",
        "consent": True,
    }
    body.update(overrides)
    return body


def _access_request(**overrides):
    body = {
        "kind": "access_request",
        "name": "Ravi Patel",
        "email": _email("access"),
        "organization_name": "Patel & Co Attorneys",
        "phone": "+27 82 000 0000",
        "consent": True,
    }
    body.update(overrides)
    return body


def _list(client, **params):
    params.setdefault("limit", 200)
    res = client.get("/owner/inquiries", params=params, headers=owner_headers())
    assert res.status_code == 200
    return res.json()


def _total(client, **params):
    return _list(client, **params)["total"]


def _find(client, email):
    matches = [i for i in _list(client)["items"] if i["email"] == email.lower()]
    assert len(matches) == 1, f"expected exactly one inquiry for {email}, found {len(matches)}"
    return matches[0]


def _summary(client):
    res = client.get("/owner/inquiries/summary", headers=owner_headers())
    assert res.status_code == 200
    return res.json()


def test_public_can_submit_a_contact_message(client):
    body = _contact()
    res = client.post("/inquiries", json=body)
    assert res.status_code == 201
    assert "message" in res.json()

    item = _find(client, body["email"])
    assert item["kind"] == "contact"
    assert item["status"] == "new"
    assert item["message"] == body["message"]


def test_access_request_requires_an_organization_name(client):
    res = client.post("/inquiries", json=_access_request(organization_name=""))
    assert res.status_code == 422


def test_contact_requires_a_message(client):
    res = client.post("/inquiries", json=_contact(message="   "))
    assert res.status_code == 422


def test_consent_is_required(client):
    assert client.post("/inquiries", json=_contact(consent=False)).status_code == 422


def test_honeypot_submission_is_accepted_but_not_stored(client):
    before = _total(client)
    res = client.post("/inquiries", json=_contact(website="http://spam.example"))
    assert res.status_code == 201
    assert _total(client) == before


def test_email_is_normalised_to_lowercase(client):
    email = _email("Mixed.Case")
    client.post("/inquiries", json=_contact(email=email))
    assert _find(client, email)["email"] == email.lower()


def test_owner_can_filter_by_kind_and_status(client):
    before_access = _total(client, kind="access_request")
    before_contact = _total(client, kind="contact")
    before_new = _total(client, status="new")

    client.post("/inquiries", json=_contact())
    client.post("/inquiries", json=_access_request())

    assert _total(client, kind="access_request") == before_access + 1
    assert _total(client, kind="contact") == before_contact + 1
    assert _total(client, status="new") == before_new + 2


def test_summary_counts_new_items_by_kind(client):
    before = _summary(client)

    client.post("/inquiries", json=_contact())
    client.post("/inquiries", json=_access_request())
    client.post("/inquiries", json=_access_request())

    after = _summary(client)
    assert after["new"] == before["new"] + 3
    assert after["new_access_requests"] == before["new_access_requests"] + 2
    assert after["new_contact"] == before["new_contact"] + 1


def test_owner_can_move_an_inquiry_through_its_states(client):
    body = _access_request()
    client.post("/inquiries", json=body)
    inquiry_id = _find(client, body["email"])["id"]

    res = client.patch(
        f"/owner/inquiries/{inquiry_id}",
        json={"status": "in_progress", "owner_note": "  Called, sending terms.  "},
        headers=owner_headers(),
    )
    assert res.status_code == 200
    updated = res.json()
    assert updated["status"] == "in_progress"
    assert updated["owner_note"] == "Called, sending terms."
    assert updated["handled_at"] is None

    res = client.patch(
        f"/owner/inquiries/{inquiry_id}",
        json={"status": "onboarded"},
        headers=owner_headers(),
    )
    assert res.json()["status"] == "onboarded"
    assert res.json()["handled_at"] is not None
    assert res.json()["owner_note"] == "Called, sending terms."


def test_reopening_an_inquiry_clears_its_handled_time(client):
    body = _contact()
    client.post("/inquiries", json=body)
    inquiry_id = _find(client, body["email"])["id"]

    closed = client.patch(f"/owner/inquiries/{inquiry_id}", json={"status": "closed"}, headers=owner_headers())
    assert closed.json()["handled_at"] is not None

    reopened = client.patch(f"/owner/inquiries/{inquiry_id}", json={"status": "new"}, headers=owner_headers())
    assert reopened.json()["status"] == "new"
    assert reopened.json()["handled_at"] is None


def test_owner_can_link_an_inquiry_to_the_organization_created_from_it(client, db_session):
    org = make_org(db_session)
    body = _access_request()
    client.post("/inquiries", json=body)
    inquiry_id = _find(client, body["email"])["id"]

    res = client.patch(
        f"/owner/inquiries/{inquiry_id}",
        json={"status": "onboarded", "organization_id": str(org.id)},
        headers=owner_headers(),
    )
    assert res.status_code == 200
    assert res.json()["organization_id"] == str(org.id)


def test_owner_can_delete_an_inquiry(client):
    body = _contact()
    client.post("/inquiries", json=body)
    inquiry_id = _find(client, body["email"])["id"]
    before = _total(client)

    assert client.delete(f"/owner/inquiries/{inquiry_id}", headers=owner_headers()).status_code == 204
    assert _total(client) == before - 1
    assert body["email"] not in [i["email"] for i in _list(client)["items"]]


def test_unknown_or_malformed_inquiry_id_is_a_404(client):
    for bad_id in ("00000000-0000-0000-0000-000000000000", "not-a-uuid"):
        res = client.patch(f"/owner/inquiries/{bad_id}", json={"status": "closed"}, headers=owner_headers())
        assert res.status_code == 404
        assert client.delete(f"/owner/inquiries/{bad_id}", headers=owner_headers()).status_code == 404


def test_inbox_is_owner_only(client, db_session):
    client.post("/inquiries", json=_contact())
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)

    assert client.get("/owner/inquiries").status_code in (401, 403)
    assert client.get("/owner/inquiries", headers=auth_headers(admin)).status_code in (401, 403)
    assert client.get("/owner/inquiries/summary", headers=auth_headers(admin)).status_code in (401, 403)
    assert client.patch("/owner/inquiries/anything", json={"status": "closed"}).status_code in (401, 403)
    assert client.delete("/owner/inquiries/anything").status_code in (401, 403)
