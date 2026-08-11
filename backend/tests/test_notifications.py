"""
Notifications: list, unread count, mark-read, mark-all-read — for both the
staff scope and the client-portal scope. Uses matter staff-assignment (staff
side) and a staff-authored message on a client-visible matter (client side)
as the two notification-generating events, since notifications are only ever
a side effect of some other action, never created directly via their own API.
"""
from tests.conftest import auth_headers, make_client_company, make_contact, make_firm, make_matter, make_staff


def test_staff_notification_lifecycle(client, db_session):
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    lawyer, _ = make_staff(db_session, firm, email="lawyer@example.com")
    client_company = make_client_company(db_session, firm)
    matter = make_matter(db_session, firm, client_company)

    assert client.get("/notifications/unread-count", headers=auth_headers(lawyer)).json()["unread_count"] == 0

    client.post(
        f"/matters/{matter.id}/assignments",
        json={"user_id": str(lawyer.id), "role_on_matter": "lead_lawyer"},
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
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    lawyer, _ = make_staff(db_session, firm, email="lawyer2@example.com")
    client_company = make_client_company(db_session, firm)
    matter = make_matter(db_session, firm, client_company)

    client.post(
        f"/matters/{matter.id}/assignments",
        json={"user_id": str(lawyer.id), "role_on_matter": "lead_lawyer"},
        headers=auth_headers(admin),
    )
    client.post(
        f"/matters/{matter.id}/assignments",
        json={"user_id": str(lawyer.id), "role_on_matter": "reviewer"},
        headers=auth_headers(admin),
    )
    assert client.get("/notifications/unread-count", headers=auth_headers(lawyer)).json()["unread_count"] == 2

    mark_all_res = client.post("/notifications/read-all", headers=auth_headers(lawyer))
    assert mark_all_res.status_code == 200
    assert client.get("/notifications/unread-count", headers=auth_headers(lawyer)).json()["unread_count"] == 0


def test_client_contact_gets_notified_of_staff_message(client, db_session):
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    client_company = make_client_company(db_session, firm)
    contact, _ = make_contact(db_session, client_company)
    matter = make_matter(db_session, firm, client_company, is_visible_to_client=True)

    client.post(
        f"/matters/{matter.id}/messages", json={"body": "Your documents are ready for review."}, headers=auth_headers(admin)
    )

    count_res = client.get("/client-notifications/unread-count", headers=auth_headers(contact))
    assert count_res.json()["unread_count"] == 1

    list_res = client.get("/client-notifications", headers=auth_headers(contact))
    assert len(list_res.json()) == 1
