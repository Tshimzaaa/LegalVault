"""
Template CRUD smoke tests. Upload/download go through Cloudflare R2
(`app.core.storage`) and a ClamAV scan (`app.core.malware_scan`), so these
monkeypatch both rather than hitting a real bucket/scanner from the test suite
— malware-scan-specific behavior is covered separately in
test_malware_scanning.py.
"""
import pytest

from tests.conftest import auth_headers, make_org, make_staff, owner_headers


@pytest.fixture(autouse=True)
def _stub_r2_and_scanner(monkeypatch):
    monkeypatch.setattr("app.modules.templates.service.upload_file", lambda *a, **k: "templates/fake-key")
    monkeypatch.setattr("app.modules.templates.service.get_download_url", lambda *a, **k: "https://example.com/fake-signed-url")
    monkeypatch.setattr("app.modules.templates.service.delete_file", lambda *a, **k: None)
    monkeypatch.setattr("app.modules.templates.service.scan_file", lambda *a, **k: None)


def _upload(client, admin, **overrides):
    return client.post(
        "/templates",
        data={
            "title": overrides.get("title", "Mutual NDA"),
            "description": overrides.get("description", "Standard mutual NDA"),
            "category": overrides.get("category", "Confidentiality"),
        },
        files={"file": ("nda.pdf", b"%PDF-1.4 fake content", "application/pdf")},
        headers=auth_headers(admin),
    )


def test_upload_and_list_template(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)

    upload_res = _upload(client, admin)
    assert upload_res.status_code == 201
    assert upload_res.json()["version"] == 1

    list_res = client.get("/templates", headers=auth_headers(admin))
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1


def test_reuploading_same_title_bumps_version(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)

    _upload(client, admin, title="NDA")
    second_res = _upload(client, admin, title="NDA")
    assert second_res.json()["version"] == 2


def test_update_body_round_trips(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    template_id = _upload(client, admin).json()["id"]

    update_res = client.patch(
        f"/templates/{template_id}",
        json={"body": "Agreement between {{client_name}} and {{counterparty}}."},
        headers=auth_headers(admin),
    )
    assert update_res.status_code == 200
    assert update_res.json()["body"] == "Agreement between {{client_name}} and {{counterparty}}."

    get_res = client.get("/templates", headers=auth_headers(admin))
    assert get_res.json()[0]["body"] == "Agreement between {{client_name}} and {{counterparty}}."


def test_update_and_delete_template(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    template_id = _upload(client, admin).json()["id"]

    update_res = client.patch(
        f"/templates/{template_id}", json={"title": "Mutual NDA v2"}, headers=auth_headers(admin)
    )
    assert update_res.status_code == 200
    assert update_res.json()["title"] == "Mutual NDA v2"

    download_res = client.get(f"/templates/{template_id}/download", headers=auth_headers(admin))
    assert download_res.status_code == 200
    assert download_res.json()["download_url"]

    delete_res = client.delete(f"/templates/{template_id}", headers=auth_headers(admin))
    assert delete_res.status_code == 204

    list_res = client.get("/templates", headers=auth_headers(admin))
    assert list_res.json() == []


def _upload_shared(client, **overrides):
    return client.post(
        "/owner/shared-templates",
        data={
            "title": overrides.get("title", "Starter NDA"),
            "description": overrides.get("description", "Platform-provided starter NDA"),
            "category": overrides.get("category", "Confidentiality"),
        },
        files={"file": ("nda.pdf", b"%PDF-1.4 fake content", "application/pdf")},
        headers=owner_headers(),
    )


def test_shared_template_visible_to_every_org_but_not_editable_by_them(client, db_session):
    org_a = make_org(db_session)
    admin_a, _ = make_staff(db_session, org_a)
    org_b = make_org(db_session)
    admin_b, _ = make_staff(db_session, org_b)

    upload_res = _upload_shared(client)
    assert upload_res.status_code == 201
    shared = upload_res.json()
    assert shared["org_id"] is None

    # Every org's own list includes the shared template alongside nothing else.
    for admin in (admin_a, admin_b):
        list_res = client.get("/templates", headers=auth_headers(admin))
        assert [t["id"] for t in list_res.json()] == [shared["id"]]

    # Any org can download it...
    download_res = client.get(f"/templates/{shared['id']}/download", headers=auth_headers(admin_a))
    assert download_res.status_code == 200

    # ...but not edit or delete it through the staff-facing endpoints.
    update_res = client.patch(
        f"/templates/{shared['id']}", json={"title": "Hijacked"}, headers=auth_headers(admin_a)
    )
    assert update_res.status_code == 404

    delete_res = client.delete(f"/templates/{shared['id']}", headers=auth_headers(admin_a))
    assert delete_res.status_code == 404


def test_owner_list_and_delete_shared_template(client, db_session):
    shared_id = _upload_shared(client).json()["id"]

    list_res = client.get("/owner/shared-templates", headers=owner_headers())
    assert [t["id"] for t in list_res.json()] == [shared_id]

    delete_res = client.delete(f"/owner/shared-templates/{shared_id}", headers=owner_headers())
    assert delete_res.status_code == 204

    assert client.get("/owner/shared-templates", headers=owner_headers()).json() == []


def test_deleting_org_does_not_delete_shared_templates(client, db_session):
    org = make_org(db_session)
    client.patch(f"/owner/orgs/{org.id}/status", json={"is_active": False}, headers=owner_headers())

    shared_id = _upload_shared(client).json()["id"]

    delete_res = client.delete(f"/owner/orgs/{org.id}", headers=owner_headers())
    assert delete_res.status_code == 204

    list_res = client.get("/owner/shared-templates", headers=owner_headers())
    assert [t["id"] for t in list_res.json()] == [shared_id]
