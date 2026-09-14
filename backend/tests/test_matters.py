"""
Matter CRUD smoke tests: create, status/visibility/deadline/title updates,
staff assignment, and the task/document/message sub-resources.
"""
import pytest

from tests.conftest import auth_headers, make_client_company, make_contact, make_org, make_matter, make_staff


@pytest.fixture(autouse=True)
def _stub_r2_and_scanner(monkeypatch):
    monkeypatch.setattr("app.modules.matters.service.upload_file", lambda *a, **k: "matter_documents/fake-key")
    monkeypatch.setattr("app.modules.matters.service.get_download_url", lambda *a, **k: "https://example.com/fake-url")
    monkeypatch.setattr("app.modules.matters.service.delete_file", lambda *a, **k: None)
    monkeypatch.setattr("app.modules.matters.service.scan_file", lambda *a, **k: None)


def test_create_and_get_matter(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    client_company = make_client_company(db_session, org)

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
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    client_company = make_client_company(db_session, org)
    matter = make_matter(db_session, org, client_company, title="Old Title")

    res = client.patch(
        f"/matters/{matter.id}",
        json={"title": "New Title", "description": "Updated"},
        headers=auth_headers(admin),
    )
    assert res.status_code == 200
    assert res.json()["title"] == "New Title"
    assert res.json()["description"] == "Updated"


def test_update_matter_status_and_visibility(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    client_company = make_client_company(db_session, org)
    matter = make_matter(db_session, org, client_company)

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
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    lawyer, _ = make_staff(db_session, org, email="lawyer@example.com")
    client_company = make_client_company(db_session, org)
    matter = make_matter(db_session, org, client_company)

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
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    client_company = make_client_company(db_session, org)
    matter = make_matter(db_session, org, client_company)

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
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    client_company = make_client_company(db_session, org)
    matter = make_matter(db_session, org, client_company)

    post_res = client.post(
        f"/matters/{matter.id}/messages", json={"body": "Please review the attached draft."}, headers=auth_headers(admin)
    )
    assert post_res.status_code == 201
    assert post_res.json()["author_type"] == "staff"

    list_res = client.get(f"/matters/{matter.id}/messages", headers=auth_headers(admin))
    assert len(list_res.json()) == 1


def test_matter_document_upload_download_delete(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    client_company = make_client_company(db_session, org)
    matter = make_matter(db_session, org, client_company)

    upload_res = client.post(
        f"/matters/{matter.id}/documents",
        data={"title": "Signed NDA"},
        files={"file": ("nda.pdf", b"fake pdf content", "application/pdf")},
        headers=auth_headers(admin),
    )
    assert upload_res.status_code == 201
    document_id = upload_res.json()["id"]
    assert upload_res.json()["version"] == 1

    list_res = client.get(f"/matters/{matter.id}/documents", headers=auth_headers(admin))
    assert len(list_res.json()) == 1

    download_res = client.get(f"/matters/{matter.id}/documents/{document_id}/download", headers=auth_headers(admin))
    assert download_res.status_code == 200
    assert download_res.json()["download_url"]

    delete_res = client.delete(f"/matters/{matter.id}/documents/{document_id}", headers=auth_headers(admin))
    assert delete_res.status_code == 204

    assert client.get(f"/matters/{matter.id}/documents", headers=auth_headers(admin)).json() == []


def test_set_list_and_remove_contact_permission(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    client_company = make_client_company(db_session, org)
    contact, contact_password = make_contact(db_session, client_company)
    matter = make_matter(db_session, org, client_company, is_visible_to_client=True)

    set_res = client.post(
        f"/matters/{matter.id}/contact-permissions",
        json={"client_contact_id": str(contact.id), "permission_level": "editor"},
        headers=auth_headers(admin),
    )
    assert set_res.status_code == 201
    body = set_res.json()
    assert body["permission_level"] == "editor"
    assert body["contact_email"] == contact.email
    assert body["matter_title"] == matter.title

    # Setting again for the same contact updates in place rather than duplicating.
    update_res = client.post(
        f"/matters/{matter.id}/contact-permissions",
        json={"client_contact_id": str(contact.id), "permission_level": "owner"},
        headers=auth_headers(admin),
    )
    assert update_res.status_code == 201
    assert update_res.json()["permission_level"] == "owner"

    list_res = client.get(f"/matters/{matter.id}/contact-permissions", headers=auth_headers(admin))
    assert len(list_res.json()) == 1
    assert list_res.json()[0]["permission_level"] == "owner"

    client_list_res = client.get("/client-matters/contact-permissions", headers=auth_headers(contact))
    assert len(client_list_res.json()) == 1
    assert client_list_res.json()[0]["matter_id"] == str(matter.id)

    remove_res = client.delete(
        f"/matters/{matter.id}/contact-permissions/{contact.id}", headers=auth_headers(admin)
    )
    assert remove_res.status_code == 204
    assert client.get(f"/matters/{matter.id}/contact-permissions", headers=auth_headers(admin)).json() == []


def test_contact_permission_rejects_contact_from_another_client(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    client_company = make_client_company(db_session, org)
    other_client_company = make_client_company(db_session, org)
    other_contact, _ = make_contact(db_session, other_client_company)
    matter = make_matter(db_session, org, client_company)

    res = client.post(
        f"/matters/{matter.id}/contact-permissions",
        json={"client_contact_id": str(other_contact.id), "permission_level": "viewer"},
        headers=auth_headers(admin),
    )
    assert res.status_code == 404
