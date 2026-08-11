"""
Matter CRUD smoke tests: create, status/visibility/deadline/title updates,
staff assignment, and the task/document/message sub-resources.
"""
from tests.conftest import auth_headers, make_client_company, make_firm, make_matter, make_staff


def test_create_and_get_matter(client, db_session):
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    client_company = make_client_company(db_session, firm)

    create_res = client.post(
        "/matters",
        json={"client_id": str(client_company.id), "title": "Master Services Agreement"},
        headers=auth_headers(admin),
    )
    assert create_res.status_code == 201
    matter_id = create_res.json()["id"]

    get_res = client.get(f"/matters/{matter_id}", headers=auth_headers(admin))
    assert get_res.status_code == 200
    assert get_res.json()["title"] == "Master Services Agreement"
    assert get_res.json()["status"] == "intake"


def test_update_matter_details(client, db_session):
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    client_company = make_client_company(db_session, firm)
    matter = make_matter(db_session, firm, client_company, title="Old Title")

    res = client.patch(
        f"/matters/{matter.id}",
        json={"title": "New Title", "description": "Updated"},
        headers=auth_headers(admin),
    )
    assert res.status_code == 200
    assert res.json()["title"] == "New Title"
    assert res.json()["description"] == "Updated"


def test_update_matter_status_and_visibility(client, db_session):
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    client_company = make_client_company(db_session, firm)
    matter = make_matter(db_session, firm, client_company)

    status_res = client.patch(
        f"/matters/{matter.id}/status", json={"status": "in_review"}, headers=auth_headers(admin)
    )
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "in_review"

    visibility_res = client.patch(
        f"/matters/{matter.id}/visibility",
        json={"is_visible_to_client": True},
        headers=auth_headers(admin),
    )
    assert visibility_res.status_code == 200
    assert visibility_res.json()["is_visible_to_client"] is True


def test_assign_staff_to_matter(client, db_session):
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    lawyer, _ = make_staff(db_session, firm, email="lawyer@example.com")
    client_company = make_client_company(db_session, firm)
    matter = make_matter(db_session, firm, client_company)

    res = client.post(
        f"/matters/{matter.id}/assignments",
        json={"user_id": str(lawyer.id), "role_on_matter": "lead_lawyer"},
        headers=auth_headers(admin),
    )
    assert res.status_code == 201

    list_res = client.get(f"/matters/{matter.id}/assignments", headers=auth_headers(admin))
    assert len(list_res.json()) == 1
    assert list_res.json()[0]["user_id"] == str(lawyer.id)


def test_matter_tasks_crud(client, db_session):
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    client_company = make_client_company(db_session, firm)
    matter = make_matter(db_session, firm, client_company)

    create_res = client.post(
        f"/matters/{matter.id}/tasks", json={"title": "Draft NDA"}, headers=auth_headers(admin)
    )
    assert create_res.status_code == 201
    task_id = create_res.json()["id"]

    update_res = client.patch(
        f"/matters/{matter.id}/tasks/{task_id}", json={"status": "done"}, headers=auth_headers(admin)
    )
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "done"

    delete_res = client.delete(f"/matters/{matter.id}/tasks/{task_id}", headers=auth_headers(admin))
    assert delete_res.status_code == 204

    list_res = client.get(f"/matters/{matter.id}/tasks", headers=auth_headers(admin))
    assert list_res.json() == []


def test_matter_messages(client, db_session):
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    client_company = make_client_company(db_session, firm)
    matter = make_matter(db_session, firm, client_company)

    post_res = client.post(
        f"/matters/{matter.id}/messages", json={"body": "Please review the attached draft."}, headers=auth_headers(admin)
    )
    assert post_res.status_code == 201
    assert post_res.json()["author_type"] == "staff"

    list_res = client.get(f"/matters/{matter.id}/messages", headers=auth_headers(admin))
    assert len(list_res.json()) == 1
