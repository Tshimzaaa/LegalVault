"""
SaaS-owner console: login, firm CRUD (create/list/detail/activate-suspend/
delete/export), platform metrics, system health, and the cross-firm audit
log. `get_current_owner` has no DB-backed identity — see owner_headers() in
conftest.py.
"""
import pytest

from app.core.config import settings
from tests.conftest import make_firm, make_staff, owner_headers


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


def test_owner_create_firm(client):
    res = client.post(
        "/owner/firms",
        json={
            "law_firm": {"name": "Owner Created Firm", "email": "owner-created@example.com"},
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
    assert res.json()["law_firm_id"]


def test_owner_list_and_get_firm(client, db_session):
    firm = make_firm(db_session)
    make_staff(db_session, firm)

    list_res = client.get("/owner/firms", headers=owner_headers())
    assert list_res.status_code == 200
    assert str(firm.id) in {f["id"] for f in list_res.json()}

    detail_res = client.get(f"/owner/firms/{firm.id}", headers=owner_headers())
    assert detail_res.status_code == 200
    assert detail_res.json()["staff_count"] == 1


def test_owner_update_firm_status(client, db_session):
    firm = make_firm(db_session)

    res = client.patch(f"/owner/firms/{firm.id}/status", json={"is_active": False}, headers=owner_headers())
    assert res.status_code == 200
    assert res.json()["is_active"] is False


def test_owner_delete_firm_requires_deactivation_first(client, db_session):
    firm = make_firm(db_session)

    blocked = client.delete(f"/owner/firms/{firm.id}", headers=owner_headers())
    assert blocked.status_code == 409

    client.patch(f"/owner/firms/{firm.id}/status", json={"is_active": False}, headers=owner_headers())
    allowed = client.delete(f"/owner/firms/{firm.id}", headers=owner_headers())
    assert allowed.status_code == 204


def test_owner_export_firm_data(client, db_session):
    firm = make_firm(db_session)
    make_staff(db_session, firm)

    res = client.get(f"/owner/firms/{firm.id}/export", headers=owner_headers())
    assert res.status_code == 200
    body = res.json()
    assert len(body["staff"]) == 1
    assert body["firm"]["id"] == str(firm.id)


def test_owner_platform_metrics(client, db_session):
    make_firm(db_session)

    res = client.get("/owner/metrics", headers=owner_headers())
    assert res.status_code == 200
    assert res.json()["usage"]["total_firms"] >= 1


def test_owner_system_health(client):
    res = client.get("/owner/system-health", headers=owner_headers())
    assert res.status_code == 200
    assert res.json()["status"] in {"operational", "degraded", "down"}


def test_owner_audit_log_visible_across_firms(client, db_session):
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)

    status_res = client.patch(f"/owner/firms/{firm.id}/status", json={"is_active": False}, headers=owner_headers())
    assert status_res.status_code == 200

    res = client.get(f"/owner/firms/audit-log?firm_id={firm.id}", headers=owner_headers())
    assert res.status_code == 200
    assert any(e["action"] == "firm.status_updated" for e in res.json())


def test_non_owner_token_rejected(client, db_session):
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    from tests.conftest import auth_headers

    res = client.get("/owner/firms", headers=auth_headers(admin))
    assert res.status_code == 401
