"""
Notifications: list, unread count, mark-read, mark-all-read — for the staff
scope. Uses contract staff-assignment as the notification-generating event,
since notifications are only ever a side effect of some other action, never
created directly via their own API.
"""
from tests.conftest import auth_headers, make_org, make_contract, make_staff


def test_staff_notification_lifecycle(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    lawyer, _ = make_staff(db_session, org, email="lawyer@example.com")
    contract = make_contract(db_session, org)

    assert client.get("/notifications/unread-count", headers=auth_headers(lawyer)).json()["unread_count"] == 0

    client.post(
        f"/contracts/{contract.id}/assignments",
        json={"user_id": str(lawyer.id), "role_on_contract": "lead_lawyer"},
        headers=auth_headers(admin),
    )

    count_res = client.get("/notifications/unread-count", headers=auth_headers(lawyer))
    assert count_res.json()["unread_count"] == 1

    list_res = client.get("/notifications", headers=auth_headers(lawyer))
    assert list_res.status_code == 200
    notifications = list_res.json()
    assert len(notifications) == 1
    assert notifications[0]["is_read"] is False

    read_res = client.patch(f"/notifications/{notifications[0]['id']}/read", headers=auth_headers(lawyer))
    assert read_res.status_code == 200
    assert read_res.json()["is_read"] is True

    assert client.get("/notifications/unread-count", headers=auth_headers(lawyer)).json()["unread_count"] == 0


def test_staff_mark_all_notifications_read(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    lawyer, _ = make_staff(db_session, org, email="lawyer2@example.com")
    contract = make_contract(db_session, org)

    client.post(
        f"/contracts/{contract.id}/assignments",
        json={"user_id": str(lawyer.id), "role_on_contract": "lead_lawyer"},
        headers=auth_headers(admin),
    )
    client.post(
        f"/contracts/{contract.id}/assignments",
        json={"user_id": str(lawyer.id), "role_on_contract": "reviewer"},
        headers=auth_headers(admin),
    )
    assert client.get("/notifications/unread-count", headers=auth_headers(lawyer)).json()["unread_count"] == 2

    mark_all_res = client.post("/notifications/read-all", headers=auth_headers(lawyer))
    assert mark_all_res.status_code == 200
    assert client.get("/notifications/unread-count", headers=auth_headers(lawyer)).json()["unread_count"] == 0
