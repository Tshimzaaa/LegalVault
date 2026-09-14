"""
Platform announcements: owner-authored, broadcast to every org's staff and
client portal — not org-scoped at all (see the RLS migration's docstring for
why this table has no org_id).
"""
from tests.conftest import auth_headers, make_client_company, make_contact, make_org, make_staff, owner_headers


def test_owner_create_update_delete_announcement(client, db_session):
    create_res = client.post(
        "/owner/announcements",
        json={"title": "Scheduled maintenance", "body": "The platform will be briefly unavailable Sunday.", "severity": "warning"},
        headers=owner_headers(),
    )
    assert create_res.status_code == 201
    announcement_id = create_res.json()["id"]

    list_res = client.get("/owner/announcements", headers=owner_headers())
    assert any(a["id"] == announcement_id for a in list_res.json())

    update_res = client.patch(
        f"/owner/announcements/{announcement_id}", json={"is_active": False}, headers=owner_headers()
    )
    assert update_res.status_code == 200
    assert update_res.json()["is_active"] is False

    delete_res = client.delete(f"/owner/announcements/{announcement_id}", headers=owner_headers())
    assert delete_res.status_code == 204


def test_active_announcement_visible_to_staff_and_client(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    client_company = make_client_company(db_session, org)
    contact, _ = make_contact(db_session, client_company)

    # Announcements are global (no org_id — see the RLS migration's docstring), so
    # the shared dev DB may already have real ones in it; check presence, not count.
    create_res = client.post(
        "/owner/announcements",
        json={"title": "New feature", "body": "Templates now support versioning.", "severity": "info"},
        headers=owner_headers(),
    )
    announcement_id = create_res.json()["id"]

    staff_res = client.get("/announcements", headers=auth_headers(admin))
    assert staff_res.status_code == 200
    assert any(a["id"] == announcement_id for a in staff_res.json())

    client_res = client.get("/client-announcements", headers=auth_headers(contact))
    assert client_res.status_code == 200
    assert any(a["id"] == announcement_id for a in client_res.json())
