"""
Org-scoped audit log (admin-only) — the staff-facing counterpart to the
owner's cross-org /owner/orgs/audit-log covered in test_owner.py.
"""
from tests.conftest import auth_headers, make_org, make_staff


def test_admin_sees_audit_log_entries_for_own_org(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)

    client.post(
        "/matters",
        json={"title": "Audited Matter"},
        headers=auth_headers(admin),
    )

    res = client.get("/audit-log", headers=auth_headers(admin))
    assert res.status_code == 200
    assert any(e["action"] == "matter.created" for e in res.json())


def test_non_admin_staff_cannot_see_audit_log(client, db_session):
    from app.modules.auth.models.role import UserRole

    org = make_org(db_session)
    paralegal, _ = make_staff(db_session, org, role=UserRole.PARALEGAL)

    res = client.get("/audit-log", headers=auth_headers(paralegal))
    assert res.status_code == 401
