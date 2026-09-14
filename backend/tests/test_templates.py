"""
Template CRUD smoke tests. Upload/download go through Cloudflare R2
(`app.core.storage`) and a ClamAV scan (`app.core.malware_scan`), so these
monkeypatch both rather than hitting a real bucket/scanner from the test suite
— malware-scan-specific behavior is covered separately in
test_malware_scanning.py.
"""
import pytest

from tests.conftest import auth_headers, make_org, make_staff


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
