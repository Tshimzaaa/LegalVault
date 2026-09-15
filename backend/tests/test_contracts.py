"""
Contract CRUD smoke tests: create, status/visibility/deadline/title updates,
staff assignment, and the task/document/message sub-resources.
"""
import pytest

from tests.conftest import auth_headers, make_org, make_contract, make_staff


@pytest.fixture(autouse=True)
def _stub_r2_and_scanner(monkeypatch):
    monkeypatch.setattr("app.modules.contracts.service.upload_file", lambda *a, **k: "contract_documents/fake-key")
    monkeypatch.setattr("app.modules.contracts.service.get_download_url", lambda *a, **k: "https://example.com/fake-url")
    monkeypatch.setattr("app.modules.contracts.service.delete_file", lambda *a, **k: None)
    monkeypatch.setattr("app.modules.contracts.service.scan_file", lambda *a, **k: None)


def test_create_and_get_contract(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)

    create_res = client.post(
        "/contracts",
        json={"title": "Master Services Agreement"},
        headers=auth_headers(admin),
    )
    assert create_res.status_code == 201
    contract_id = create_res.json()["id"]

    get_res = client.get(f"/contracts/{contract_id}", headers=auth_headers(admin))
    assert get_res.status_code == 200
    assert get_res.json()["title"] == "Master Services Agreement"
    assert get_res.json()["status"] == "intake"


def test_update_contract_details(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    contract = make_contract(db_session, org, title="Old Title")

    res = client.patch(
        f"/contracts/{contract.id}",
        json={"title": "New Title", "description": "Updated"},
        headers=auth_headers(admin),
    )
    assert res.status_code == 200
    assert res.json()["title"] == "New Title"
    assert res.json()["description"] == "Updated"


def test_update_contract_status(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    contract = make_contract(db_session, org)

    status_res = client.patch(
        f"/contracts/{contract.id}/status", json={"status": "in_review"}, headers=auth_headers(admin)
    )
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "in_review"


def test_assign_staff_to_contract(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    lawyer, _ = make_staff(db_session, org, email="lawyer@example.com")
    contract = make_contract(db_session, org)

    res = client.post(
        f"/contracts/{contract.id}/assignments",
        json={"user_id": str(lawyer.id), "role_on_contract": "lead_lawyer"},
        headers=auth_headers(admin),
    )
    assert res.status_code == 201

    list_res = client.get(f"/contracts/{contract.id}/assignments", headers=auth_headers(admin))
    assert len(list_res.json()) == 1
    assert list_res.json()[0]["user_id"] == str(lawyer.id)


def test_contract_tasks_crud(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    contract = make_contract(db_session, org)

    create_res = client.post(
        f"/contracts/{contract.id}/tasks", json={"title": "Draft NDA"}, headers=auth_headers(admin)
    )
    assert create_res.status_code == 201
    task_id = create_res.json()["id"]

    update_res = client.patch(
        f"/contracts/{contract.id}/tasks/{task_id}", json={"status": "done"}, headers=auth_headers(admin)
    )
    assert update_res.status_code == 200
    assert update_res.json()["status"] == "done"

    delete_res = client.delete(f"/contracts/{contract.id}/tasks/{task_id}", headers=auth_headers(admin))
    assert delete_res.status_code == 204

    list_res = client.get(f"/contracts/{contract.id}/tasks", headers=auth_headers(admin))
    assert list_res.json() == []


def test_contract_messages(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    contract = make_contract(db_session, org)

    post_res = client.post(
        f"/contracts/{contract.id}/messages", json={"body": "Please review the attached draft."}, headers=auth_headers(admin)
    )
    assert post_res.status_code == 201
    assert post_res.json()["author_type"] == "staff"

    list_res = client.get(f"/contracts/{contract.id}/messages", headers=auth_headers(admin))
    assert len(list_res.json()) == 1


def test_contract_document_upload_download_delete(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    contract = make_contract(db_session, org)

    upload_res = client.post(
        f"/contracts/{contract.id}/documents",
        data={"title": "Signed NDA"},
        files={"file": ("nda.pdf", b"fake pdf content", "application/pdf")},
        headers=auth_headers(admin),
    )
    assert upload_res.status_code == 201
    document_id = upload_res.json()["id"]
    assert upload_res.json()["version"] == 1

    list_res = client.get(f"/contracts/{contract.id}/documents", headers=auth_headers(admin))
    assert len(list_res.json()) == 1

    download_res = client.get(f"/contracts/{contract.id}/documents/{document_id}/download", headers=auth_headers(admin))
    assert download_res.status_code == 200
    assert download_res.json()["download_url"]

    delete_res = client.delete(f"/contracts/{contract.id}/documents/{document_id}", headers=auth_headers(admin))
    assert delete_res.status_code == 204

    assert client.get(f"/contracts/{contract.id}/documents", headers=auth_headers(admin)).json() == []
