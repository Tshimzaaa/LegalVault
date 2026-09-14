"""
Client company + client-contact CRUD smoke tests: create, invite, accept,
login, deactivate, delete, and the guard against deleting a client that still
has matters.
"""
from tests.conftest import auth_headers, make_client_company, make_contact, make_org, make_matter, make_staff


def test_create_client(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)

    res = client.post("/clients", json={"company_name": "Northwind Traders"}, headers=auth_headers(admin))
    assert res.status_code == 201
    assert res.json()["company_name"] == "Northwind Traders"


def test_invite_contact_and_accept_and_login(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    client_company = make_client_company(db_session, org)

    invite_res = client.post(
        f"/clients/{client_company.id}/contacts",
        json={"first_name": "Cara", "last_name": "Contact", "email": "cara@example.com"},
        headers=auth_headers(admin),
    )
    assert invite_res.status_code == 201
    assert invite_res.json()["invitation_status"] == "pending"

    # invitation_token is intentionally excluded from the API response — read it
    # straight off the row, same as a real "click the emailed link" flow would.
    from app.modules.clients.models import ClientContact

    contact = db_session.query(ClientContact).filter_by(email="cara@example.com").one()
    assert contact.invitation_token

    accept_res = client.post(
        "/client-auth/accept-invite",
        json={"token": contact.invitation_token, "password": "ContactPassword123!"},
    )
    assert accept_res.status_code == 200
    assert accept_res.json()["invitation_status"] == "accepted"

    login_res = client.post(
        "/client-auth/login", json={"email": "cara@example.com", "password": "ContactPassword123!"}
    )
    assert login_res.status_code == 200


def test_deactivate_client_blocks_login_immediately(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    client_company = make_client_company(db_session, org)
    contact, password = make_contact(db_session, client_company)

    res = client.get("/client-auth/me", headers=auth_headers(contact))
    assert res.status_code == 200

    toggle_res = client.patch(
        f"/clients/{client_company.id}/contacts/{contact.id}/status",
        json={"is_active": False},
        headers=auth_headers(admin),
    )
    assert toggle_res.status_code == 200

    assert client.get("/client-auth/me", headers=auth_headers(contact)).status_code == 403


def test_client_password_reset_invalidates_previously_issued_access_token(client, db_session):
    org = make_org(db_session)
    client_company = make_client_company(db_session, org)
    contact, _ = make_contact(db_session, client_company, email="resetcontact@example.com")
    old_access_token_headers = auth_headers(contact)

    assert client.get("/client-auth/me", headers=old_access_token_headers).status_code == 200

    forgot_res = client.post("/client-auth/forgot-password", json={"email": "resetcontact@example.com"})
    assert forgot_res.status_code == 200

    db_session.refresh(contact)
    assert contact.reset_token is not None

    reset_res = client.post(
        "/client-auth/reset-password",
        json={"token": contact.reset_token, "new_password": "BrandNewPassword456!"},
    )
    assert reset_res.status_code == 200

    assert client.get("/client-auth/me", headers=old_access_token_headers).status_code == 401


def test_delete_client_blocked_when_matters_exist(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    client_company = make_client_company(db_session, org)
    make_matter(db_session, org, client_company)

    res = client.delete(f"/clients/{client_company.id}", headers=auth_headers(admin))
    assert res.status_code == 409


def test_delete_client_without_matters_succeeds(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    client_company = make_client_company(db_session, org)

    res = client.delete(f"/clients/{client_company.id}", headers=auth_headers(admin))
    assert res.status_code == 204

    list_res = client.get("/clients", headers=auth_headers(admin))
    assert str(client_company.id) not in {c["id"] for c in list_res.json()}
