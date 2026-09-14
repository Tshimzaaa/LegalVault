"""
Force-logout: kills a staff member's or client contact's active sessions
immediately, without deactivating the account.
"""
from tests.conftest import auth_headers, make_client_company, make_contact, make_org, make_staff


def test_force_logout_staff_kills_live_access_token_immediately(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    target, _ = make_staff(db_session, org, email="target@example.com")
    target_headers = auth_headers(target)

    assert client.get("/auth/me", headers=target_headers).status_code == 200

    res = client.post(f"/auth/users/{target.id}/force-logout", headers=auth_headers(admin))
    assert res.status_code == 204

    # The account is still active — force-logout isn't deactivation.
    db_session.refresh(target)
    assert target.is_active is True

    # But the live access token is dead immediately, not just on next expiry.
    assert client.get("/auth/me", headers=target_headers).status_code == 401


def test_force_logout_staff_revokes_refresh_token(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    target, password = make_staff(db_session, org, email="target2@example.com")

    login_res = client.post("/auth/login", json={"email": "target2@example.com", "password": password})
    refresh_token = login_res.json()["refresh_token"]

    client.post(f"/auth/users/{target.id}/force-logout", headers=auth_headers(admin))

    reuse_res = client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert reuse_res.status_code == 401


def test_force_logout_contact_kills_live_access_token_immediately(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    client_company = make_client_company(db_session, org)
    contact, _ = make_contact(db_session, client_company)
    contact_headers = auth_headers(contact)

    assert client.get("/client-auth/me", headers=contact_headers).status_code == 200

    res = client.post(
        f"/clients/{client_company.id}/contacts/{contact.id}/force-logout",
        headers=auth_headers(admin),
    )
    assert res.status_code == 200

    db_session.refresh(contact)
    assert contact.is_active is True

    assert client.get("/client-auth/me", headers=contact_headers).status_code == 401
