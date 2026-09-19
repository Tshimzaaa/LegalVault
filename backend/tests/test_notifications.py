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


def _unread(client, user) -> int:
    return client.get("/notifications/unread-count", headers=auth_headers(user)).json()["unread_count"]


def test_assigning_a_task_to_yourself_does_not_notify_you(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    lawyer, _ = make_staff(db_session, org, email="lawyer-tasks@example.com")
    contract = make_contract(db_session, org)

    own = client.post(
        f"/contracts/{contract.id}/tasks",
        json={"title": "My own task", "assigned_to": str(admin.id)},
        headers=auth_headers(admin),
    )
    assert own.status_code == 201
    assert _unread(client, admin) == 0

    other = client.post(
        f"/contracts/{contract.id}/tasks",
        json={"title": "Someone else's task", "assigned_to": str(lawyer.id)},
        headers=auth_headers(admin),
    )
    assert other.status_code == 201
    assert _unread(client, lawyer) == 1
    assert _unread(client, admin) == 0


def test_reassigning_a_task_only_notifies_someone_other_than_the_actor(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    lawyer, _ = make_staff(db_session, org, email="lawyer-reassign@example.com")
    contract = make_contract(db_session, org)
    task_id = client.post(
        f"/contracts/{contract.id}/tasks", json={"title": "Unassigned task"}, headers=auth_headers(admin)
    ).json()["id"]

    client.patch(
        f"/contracts/{contract.id}/tasks/{task_id}",
        json={"assigned_to": str(admin.id)},
        headers=auth_headers(admin),
    )
    assert _unread(client, admin) == 0

    client.patch(
        f"/contracts/{contract.id}/tasks/{task_id}",
        json={"assigned_to": str(lawyer.id)},
        headers=auth_headers(admin),
    )
    assert _unread(client, lawyer) == 1


def test_assigning_yourself_to_a_contract_does_not_notify_you(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    contract = make_contract(db_session, org)

    res = client.post(
        f"/contracts/{contract.id}/assignments",
        json={"user_id": str(admin.id), "role_on_contract": "lead_lawyer"},
        headers=auth_headers(admin),
    )
    assert res.status_code == 201
    assert _unread(client, admin) == 0
