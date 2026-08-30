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


def test_search_matches_whole_words_not_mid_word_substrings(client, db_session):
    """Full-text search matches lexemes, not arbitrary substrings — a deliberate,
    accepted change from the old ILIKE '%...%' behavior, not a regression."""
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    client_company = make_client_company(db_session, firm)
    make_matter(db_session, firm, client_company, title="Findable Merger Agreement")

    res = client.get("/search?q=indable", headers=auth_headers(admin))
    assert res.status_code == 200
    assert res.json()["matters"] == []


def test_search_multi_word_query_is_implicit_and(client, db_session):
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    client_company = make_client_company(db_session, firm)
    make_matter(db_session, firm, client_company, title="Merger Agreement")
    make_matter(db_session, firm, client_company, title="Merger Only")

    res = client.get("/search?q=Merger Agreement", headers=auth_headers(admin))
    assert res.status_code == 200
    titles = [m["title"] for m in res.json()["matters"]]
    assert titles == ["Merger Agreement"]


def test_search_ranks_stronger_match_first(client, db_session):
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    client_company = make_client_company(db_session, firm)
    # "Contract" appears twice in the title, so it should rank above a matter where
    # the term only appears once.
    make_matter(db_session, firm, client_company, title="Contract Contract Review")
    make_matter(db_session, firm, client_company, title="Contract Review", description="Something else")

    res = client.get("/search?q=Contract", headers=auth_headers(admin))
    assert res.status_code == 200
    titles = [m["title"] for m in res.json()["matters"]]
    assert titles[0] == "Contract Contract Review"


def test_search_finds_contact_and_staff_and_document(client, db_session, monkeypatch):
    monkeypatch.setattr("app.modules.matters.service.upload_file", lambda *a, **k: "matter_documents/fake-key")
    monkeypatch.setattr("app.modules.matters.service.scan_file", lambda *a, **k: None)

    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    lawyer, _ = make_staff(db_session, firm, first_name="Zephyr", last_name="Okoye", email="zephyr@example.com")
    client_company = make_client_company(db_session, firm)
    contact, _ = make_contact(db_session, client_company, first_name="Zephyr", last_name="Contactperson")
    matter = make_matter(db_session, firm, client_company)

    upload_res = client.post(
        f"/matters/{matter.id}/documents",
        data={"title": "Zephyr Filing"},
        files={"file": ("zephyr.pdf", b"%PDF-1.4 fake", "application/pdf")},
        headers=auth_headers(admin),
    )
    assert upload_res.status_code == 201

    res = client.get("/search?q=Zephyr", headers=auth_headers(admin))
    assert res.status_code == 200
    body = res.json()
    assert any(c["id"] == str(contact.id) for c in body["contacts"])
    assert any(s["id"] == str(lawyer.id) for s in body["staff"])
    assert any(d["title"] == "Zephyr Filing" for d in body["documents"])
