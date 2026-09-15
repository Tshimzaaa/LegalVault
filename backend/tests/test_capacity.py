"""
Resource/capacity planning: admin sets a staff member's weekly capacity hours,
and reporting's staff_workload reflects it plus a derived utilization estimate.
"""
from tests.conftest import auth_headers, make_contract, make_org, make_staff


def test_admin_sets_staff_capacity(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)

    res = client.patch(
        f"/auth/users/{admin.id}/capacity",
        json={"weekly_capacity_hours": 30},
        headers=auth_headers(admin),
    )
    assert res.status_code == 200
    assert res.json()["weekly_capacity_hours"] == 30


def test_capacity_rejects_out_of_range_values(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)

    res = client.patch(
        f"/auth/users/{admin.id}/capacity",
        json={"weekly_capacity_hours": 500},
        headers=auth_headers(admin),
    )
    assert res.status_code == 422


def test_reporting_shows_utilization_once_capacity_set(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    contract = make_contract(db_session, org)
    for i in range(2):
        client.post(
            f"/contracts/{contract.id}/tasks",
            json={"title": f"Task {i}", "assigned_to": str(admin.id)},
            headers=auth_headers(admin),
        )

    client.patch(f"/auth/users/{admin.id}/capacity", json={"weekly_capacity_hours": 8}, headers=auth_headers(admin))

    res = client.get("/reporting/overview", headers=auth_headers(admin))
    assert res.status_code == 200
    workload = next(w for w in res.json()["staff_workload"] if w["user_id"] == str(admin.id))
    assert workload["weekly_capacity_hours"] == 8
    # 2 open tasks * 2.0 assumed hours / 8 capacity hours = 50%
    assert workload["utilization_percent"] == 50.0


def test_reporting_utilization_null_without_capacity(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    make_contract(db_session, org)

    res = client.get("/reporting/overview", headers=auth_headers(admin))
    workload = next(w for w in res.json()["staff_workload"] if w["user_id"] == str(admin.id))
    assert workload["weekly_capacity_hours"] is None
    assert workload["utilization_percent"] is None


def test_non_admin_cannot_set_capacity(client, db_session):
    from app.modules.auth.models.role import UserRole

    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    lawyer, _ = make_staff(db_session, org, role=UserRole.LAWYER)

    res = client.patch(
        f"/auth/users/{admin.id}/capacity",
        json={"weekly_capacity_hours": 20},
        headers=auth_headers(lawyer),
    )
    assert res.status_code == 401  # require_admin raises InvalidCredentials
