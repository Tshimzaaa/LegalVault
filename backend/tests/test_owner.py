"""
SaaS-owner console: login, org CRUD (create/list/detail/activate-suspend/
delete/export), platform metrics, system health, and the cross-org audit
log. `get_current_owner` has no DB-backed identity — see owner_headers() in
conftest.py.
"""
import pytest

from app.core.config import settings
from tests.conftest import make_org, make_staff, owner_headers


@pytest.fixture(autouse=True)
def _stub_r2(monkeypatch):
    monkeypatch.setattr("app.modules.owner.routes.get_download_url", lambda *a, **k: "https://example.com/fake-url")
    monkeypatch.setattr("app.modules.owner.routes.get_r2_client", lambda: _FakeR2Client())


class _FakeR2Client:
    def head_bucket(self, **_kwargs):
        return {}


def test_owner_login_success_and_wrong_secret(client):
    good = client.post("/owner/login", json={"secret": settings.OWNER_SECRET})
    assert good.status_code == 200
    assert good.json()["access_token"]

    bad = client.post("/owner/login", json={"secret": "not-the-secret"})
    assert bad.status_code == 401


def test_owner_create_org(client):
    res = client.post(
        "/owner/orgs",
        json={
            "organization": {"name": "Owner Created Org", "email": "owner-created@example.com"},
            "admin": {
                "first_name": "Ola",
                "last_name": "Admin",
                "email": "ola@example.com",
                "password": "TestPassword123!",
            },
        },
        headers=owner_headers(),
    )
    assert res.status_code == 201
    assert res.json()["organization_id"]


def test_owner_list_and_get_org(client, db_session):
    org = make_org(db_session)
    make_staff(db_session, org)

    list_res = client.get("/owner/orgs", headers=owner_headers())
    assert list_res.status_code == 200
    assert str(org.id) in {f["id"] for f in list_res.json()}

    detail_res = client.get(f"/owner/orgs/{org.id}", headers=owner_headers())
    assert detail_res.status_code == 200
    assert detail_res.json()["staff_count"] == 1


def test_owner_update_org_status(client, db_session):
    org = make_org(db_session)

    res = client.patch(f"/owner/orgs/{org.id}/status", json={"is_active": False}, headers=owner_headers())
    assert res.status_code == 200
    assert res.json()["is_active"] is False


def test_owner_delete_org_requires_deactivation_first(client, db_session):
    org = make_org(db_session)

    blocked = client.delete(f"/owner/orgs/{org.id}", headers=owner_headers())
    assert blocked.status_code == 409

    client.patch(f"/owner/orgs/{org.id}/status", json={"is_active": False}, headers=owner_headers())
    allowed = client.delete(f"/owner/orgs/{org.id}", headers=owner_headers())
    assert allowed.status_code == 204


def test_owner_export_org_data(client, db_session):
    org = make_org(db_session)
    make_staff(db_session, org)

    res = client.get(f"/owner/orgs/{org.id}/export", headers=owner_headers())
    assert res.status_code == 200
    body = res.json()
    assert len(body["staff"]) == 1
    assert body["org"]["id"] == str(org.id)


def test_owner_platform_metrics(client, db_session):
    make_org(db_session)

    res = client.get("/owner/metrics", headers=owner_headers())
    assert res.status_code == 200
    assert res.json()["usage"]["total_orgs"] >= 1


def test_owner_system_health(client):
    res = client.get("/owner/system-health", headers=owner_headers())
    assert res.status_code == 200
    assert res.json()["status"] in {"operational", "degraded", "down"}


def test_owner_audit_log_visible_across_orgs(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)

    status_res = client.patch(f"/owner/orgs/{org.id}/status", json={"is_active": False}, headers=owner_headers())
    assert status_res.status_code == 200

    res = client.get(f"/owner/orgs/audit-log?org_id={org.id}", headers=owner_headers())
    assert res.status_code == 200
    assert any(e["action"] == "org.status_updated" for e in res.json())


def test_non_owner_token_rejected(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    from tests.conftest import auth_headers

    res = client.get("/owner/orgs", headers=auth_headers(admin))
    assert res.status_code == 401
