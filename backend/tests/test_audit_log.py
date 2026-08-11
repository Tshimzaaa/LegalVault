"""
Firm-scoped audit log (admin-only) — the staff-facing counterpart to the
owner's cross-firm /owner/firms/audit-log covered in test_owner.py.
"""
from tests.conftest import auth_headers, make_client_company, make_firm, make_staff


def test_admin_sees_audit_log_entries_for_own_firm(client, db_session):
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    client_company = make_client_company(db_session, firm)

    client.post(
        "/matters",
        json={"client_id": str(client_company.id), "title": "Audited Matter"},
        headers=auth_headers(admin),
    )

    res = client.get("/audit-log", headers=auth_headers(admin))
    assert res.status_code == 200
    assert any(e["action"] == "matter.created" for e in res.json())


def test_non_admin_staff_cannot_see_audit_log(client, db_session):
    from app.modules.auth.models.role import UserRole

    firm = make_firm(db_session)
    paralegal, _ = make_staff(db_session, firm, role=UserRole.PARALEGAL)

    res = client.get("/audit-log", headers=auth_headers(paralegal))
    assert res.status_code == 401
