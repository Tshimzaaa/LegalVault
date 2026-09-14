"""
Fallback clauses: org staff CRUD on the pre-approved clause library, and the
client-portal read-only view backing "My Learned Friend".
"""
from app.modules.auth.models.role import UserRole
from tests.conftest import auth_headers, make_client_company, make_contact, make_org, make_staff


def _create(client, admin, **overrides):
    return client.post(
        "/fallback-clauses",
        json={
            "name": overrides.get("name", "Limitation of Liability (Fallback)"),
            "category": overrides.get("category", "Risk"),
            "description": overrides.get("description", "Pre-approved fallback cap."),
            "content": overrides.get("content", "Liability shall not exceed 12 months' fees."),
            "pre_approved": overrides.get("pre_approved", True),
        },
        headers=auth_headers(admin),
    )


def test_create_and_list_fallback_clause(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)

    create_res = _create(client, admin)
    assert create_res.status_code == 201
    assert create_res.json()["name"] == "Limitation of Liability (Fallback)"

    list_res = client.get("/fallback-clauses", headers=auth_headers(admin))
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1


def test_update_and_delete_fallback_clause(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    clause_id = _create(client, admin).json()["id"]

    update_res = client.patch(
        f"/fallback-clauses/{clause_id}", json={"pre_approved": False}, headers=auth_headers(admin)
    )
    assert update_res.status_code == 200
    assert update_res.json()["pre_approved"] is False

    delete_res = client.delete(f"/fallback-clauses/{clause_id}", headers=auth_headers(admin))
    assert delete_res.status_code == 204

    list_res = client.get("/fallback-clauses", headers=auth_headers(admin))
    assert list_res.json() == []


def test_client_can_list_org_fallback_clauses(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    client_company = make_client_company(db_session, org)
    contact, _ = make_contact(db_session, client_company)
    _create(client, admin)

    list_res = client.get("/client-fallback-clauses", headers=auth_headers(contact))
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1


def test_non_admin_lawyer_cannot_delete_fallback_clause(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    lawyer, _ = make_staff(db_session, org, role=UserRole.LAWYER)
    clause_id = _create(client, admin).json()["id"]

    delete_res = client.delete(f"/fallback-clauses/{clause_id}", headers=auth_headers(lawyer))
    assert delete_res.status_code == 403
