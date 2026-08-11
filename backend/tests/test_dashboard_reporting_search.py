"""
Read-only aggregation endpoints: staff dashboard summary, client dashboard
summary, reporting overview + CSV export, and firm-scoped search.
"""
from tests.conftest import auth_headers, make_client_company, make_contact, make_firm, make_matter, make_staff


def test_staff_dashboard_summary(client, db_session):
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    client_company = make_client_company(db_session, firm)
    make_matter(db_session, firm, client_company, title="Dashboard Matter")

    res = client.get("/dashboard/summary", headers=auth_headers(admin))
    assert res.status_code == 200
    assert res.json()["contractStatus"]["total"] == 1


def test_client_dashboard_summary(client, db_session):
    firm = make_firm(db_session)
    client_company = make_client_company(db_session, firm)
    contact, _ = make_contact(db_session, client_company)
    make_matter(db_session, firm, client_company, is_visible_to_client=True)

    res = client.get("/client-dashboard/summary", headers=auth_headers(contact))
    assert res.status_code == 200
    assert res.json()["openMatters"] == 1


def test_reporting_overview_and_csv_export(client, db_session):
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    client_company = make_client_company(db_session, firm)
    make_matter(db_session, firm, client_company, title="Reported Matter")

    overview_res = client.get("/reporting/overview", headers=auth_headers(admin))
    assert overview_res.status_code == 200
    assert overview_res.json()["total_matters"] == 1

    export_res = client.get("/reporting/matters/export", headers=auth_headers(admin))
    assert export_res.status_code == 200
    assert export_res.headers["content-type"].startswith("text/csv")
    assert b"Reported Matter" in export_res.content


def test_search_finds_matter_by_title(client, db_session):
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    client_company = make_client_company(db_session, firm)
    make_matter(db_session, firm, client_company, title="Findable Merger Agreement")

    res = client.get("/search?q=Findable", headers=auth_headers(admin))
    assert res.status_code == 200
    assert any(m["title"] == "Findable Merger Agreement" for m in res.json()["matters"])
