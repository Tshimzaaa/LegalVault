"""
Staff auth: register, login, refresh rotation, logout, tokens_invalid_before
revocation, and deactivation being enforced immediately (not just on next login).
"""
from datetime import UTC, datetime

from app.core.config import settings
from tests.conftest import auth_headers, make_org, make_staff


def _register_payload(**overrides):
    return {
        "organization": {
            "name": "Acme Legal",
            "email": overrides.get("org_email", "acme-legal@example.com"),
        },
        "admin": {
            "first_name": "Ada",
            "last_name": "Admin",
            "email": overrides.get("admin_email", "ada@example.com"),
            "password": "TestPassword123!",
        },
    }


def test_public_registration_is_refused_by_default(client):
    res = client.post("/auth/register", json=_register_payload())
    assert res.status_code == 403
    assert "invitation" in res.json()["detail"].lower()


def test_register_creates_org_and_admin(client, monkeypatch):
    monkeypatch.setattr(settings, "ALLOW_PUBLIC_REGISTRATION", True)
    res = client.post("/auth/register", json=_register_payload())
    assert res.status_code == 201
    body = res.json()
    assert body["organization_id"]
    assert body["user_id"]
    assert body["access_token"]


def test_login_success(client, db_session):
    org = make_org(db_session)
    staff, password = make_staff(db_session, org, email="lucy@example.com")

    res = client.post("/auth/login", json={"email": "lucy@example.com", "password": password})
    assert res.status_code == 200
    body = res.json()
    assert body["access_token"]
    assert body["refresh_token"]


def test_login_wrong_password_rejected(client, db_session):
    org = make_org(db_session)
    make_staff(db_session, org, email="lucy2@example.com")

    res = client.post("/auth/login", json={"email": "lucy2@example.com", "password": "wrong-password"})
    assert res.status_code == 401


def test_login_deactivated_staff_rejected(client, db_session):
    org = make_org(db_session)
    staff, password = make_staff(db_session, org, email="deactivated@example.com", is_active=False)

    res = client.post("/auth/login", json={"email": "deactivated@example.com", "password": password})
    assert res.status_code == 403


def test_deactivated_staff_access_token_rejected_immediately(client, db_session):
    # A live access token must stop working the instant is_active flips, not just
    # on the next login — get_current_user re-checks is_active from the DB on
    # every request.
    org = make_org(db_session)
    staff, _ = make_staff(db_session, org)
    headers = auth_headers(staff)

    assert client.get("/auth/me", headers=headers).status_code == 200

    staff.is_active = False
    db_session.flush()

    assert client.get("/auth/me", headers=headers).status_code == 403


def test_refresh_rotates_token_and_old_one_cannot_be_reused(client, db_session):
    org = make_org(db_session)
    staff, password = make_staff(db_session, org, email="refresh-me@example.com")

    login_res = client.post("/auth/login", json={"email": "refresh-me@example.com", "password": password})
    old_refresh_token = login_res.json()["refresh_token"]

    refresh_res = client.post("/auth/refresh", json={"refresh_token": old_refresh_token})
    assert refresh_res.status_code == 200
    assert refresh_res.json()["refresh_token"] != old_refresh_token

    # The old (now-rotated) refresh token must be dead.
    replay_res = client.post("/auth/refresh", json={"refresh_token": old_refresh_token})
    assert replay_res.status_code == 401


def test_logout_revokes_refresh_token(client, db_session):
    org = make_org(db_session)
    staff, password = make_staff(db_session, org, email="logout-me@example.com")

    login_res = client.post("/auth/login", json={"email": "logout-me@example.com", "password": password})
    refresh_token = login_res.json()["refresh_token"]

    logout_res = client.post("/auth/logout", json={"refresh_token": refresh_token})
    assert logout_res.status_code == 204

    reuse_res = client.post("/auth/refresh", json={"refresh_token": refresh_token})
    assert reuse_res.status_code == 401


def test_password_reset_invalidates_previously_issued_access_token(client, db_session):
    org = make_org(db_session)
    staff, _ = make_staff(db_session, org, email="resetme@example.com")
    old_access_token_headers = auth_headers(staff)

    assert client.get("/auth/me", headers=old_access_token_headers).status_code == 200

    forgot_res = client.post("/auth/forgot-password", json={"email": "resetme@example.com"})
    assert forgot_res.status_code == 200

    db_session.refresh(staff)
    assert staff.reset_token is not None

    reset_res = client.post(
        "/auth/reset-password",
        json={"token": staff.reset_token, "new_password": "BrandNewPassword456!"},
    )
    assert reset_res.status_code == 200

    # The access token issued before the reset must now be rejected, even though
    # it hasn't naturally expired yet — tokens_invalid_before is what does this.
    assert client.get("/auth/me", headers=old_access_token_headers).status_code == 401

    # And the new password actually works.
    login_res = client.post("/auth/login", json={"email": "resetme@example.com", "password": "BrandNewPassword456!"})
    assert login_res.status_code == 200


def test_staff_invite_accept_flow(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)  # defaults to UserRole.ADMIN — invite-staff requires an admin

    invite_res = client.post(
        "/auth/invite-staff",
        json={"first_name": "New", "last_name": "Hire", "email": "newhire@example.com", "role": "lawyer"},
        headers=auth_headers(admin),
    )
    assert invite_res.status_code == 201
    invitation_token = invite_res.json()["invitation_token"]
    assert invitation_token

    accept_res = client.post(
        "/auth/accept-staff-invite",
        json={"token": invitation_token, "password": "NewHirePassword789!"},
    )
    assert accept_res.status_code == 200

    login_res = client.post(
        "/auth/login", json={"email": "newhire@example.com", "password": "NewHirePassword789!"}
    )
    assert login_res.status_code == 200
