"""
Support requests: a client submits one, staff can list/triage and update its
status. (Notification fan-out to staff on creation is covered implicitly —
see test_notifications.py for the notification itself.)
"""
from tests.conftest import auth_headers, make_client_company, make_contact, make_firm, make_staff


def test_client_creates_support_request_and_staff_can_see_it(client, db_session):
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    client_company = make_client_company(db_session, firm)
    contact, _ = make_contact(db_session, client_company)

    create_res = client.post(
        "/client-support-requests",
        json={"request_type": "nda", "description": "Please review this NDA before we sign."},
        headers=auth_headers(contact),
    )
    assert create_res.status_code == 201
    assert create_res.json()["status"] == "open"

    mine_res = client.get("/client-support-requests", headers=auth_headers(contact))
    assert mine_res.status_code == 200
    assert len(mine_res.json()) == 1

    staff_res = client.get("/support-requests", headers=auth_headers(admin))
    assert staff_res.status_code == 200
    assert len(staff_res.json()) == 1


def test_staff_updates_support_request_status(client, db_session):
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    client_company = make_client_company(db_session, firm)
    contact, _ = make_contact(db_session, client_company)

    request_id = client.post(
        "/client-support-requests",
        json={"request_type": "general", "description": "Quick question about our engagement letter."},
        headers=auth_headers(contact),
    ).json()["id"]

    res = client.patch(
        f"/support-requests/{request_id}/status", json={"status": "in_progress"}, headers=auth_headers(admin)
    )
    assert res.status_code == 200
    assert res.json()["status"] == "in_progress"
