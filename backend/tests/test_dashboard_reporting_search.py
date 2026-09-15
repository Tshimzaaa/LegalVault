"""
Read-only aggregation endpoints: staff dashboard summary, reporting overview
+ CSV export, and org-scoped search.
"""
from tests.conftest import auth_headers, make_org, make_contract, make_staff


def test_staff_dashboard_summary(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    make_contract(db_session, org, title="Dashboard Contract")

    res = client.get("/dashboard/summary", headers=auth_headers(admin))
    assert res.status_code == 200
    assert res.json()["contractStatus"]["total"] == 1


def test_reporting_overview_and_csv_export(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    make_contract(db_session, org, title="Reported Contract")

    overview_res = client.get("/reporting/overview", headers=auth_headers(admin))
    assert overview_res.status_code == 200
    assert overview_res.json()["total_contracts"] == 1

    export_res = client.get("/reporting/contracts/export", headers=auth_headers(admin))
    assert export_res.status_code == 200
    assert export_res.headers["content-type"].startswith("text/csv")
    assert b"Reported Contract" in export_res.content


def test_search_finds_contract_by_title(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    make_contract(db_session, org, title="Findable Merger Agreement")

    res = client.get("/search?q=Findable", headers=auth_headers(admin))
    assert res.status_code == 200
    assert any(m["title"] == "Findable Merger Agreement" for m in res.json()["contracts"])


def test_search_matches_whole_words_not_mid_word_substrings(client, db_session):
    """Full-text search matches lexemes, not arbitrary substrings — a deliberate,
    accepted change from the old ILIKE '%...%' behavior, not a regression."""
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    make_contract(db_session, org, title="Findable Merger Agreement")

    res = client.get("/search?q=indable", headers=auth_headers(admin))
    assert res.status_code == 200
    assert res.json()["contracts"] == []


def test_search_multi_word_query_is_implicit_and(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    make_contract(db_session, org, title="Merger Agreement")
    make_contract(db_session, org, title="Merger Only")

    res = client.get("/search?q=Merger Agreement", headers=auth_headers(admin))
    assert res.status_code == 200
    titles = [m["title"] for m in res.json()["contracts"]]
    assert titles == ["Merger Agreement"]


def test_search_ranks_stronger_match_first(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    # "Contract" appears twice in the title, so it should rank above a contract where
    # the term only appears once.
    make_contract(db_session, org, title="Contract Contract Review")
    make_contract(db_session, org, title="Contract Review", description="Something else")

    res = client.get("/search?q=Contract", headers=auth_headers(admin))
    assert res.status_code == 200
    titles = [m["title"] for m in res.json()["contracts"]]
    assert titles[0] == "Contract Contract Review"


def test_search_finds_staff_and_document(client, db_session, monkeypatch):
    monkeypatch.setattr("app.modules.contracts.service.upload_file", lambda *a, **k: "contract_documents/fake-key")
    monkeypatch.setattr("app.modules.contracts.service.scan_file", lambda *a, **k: None)

    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    lawyer, _ = make_staff(db_session, org, first_name="Zephyr", last_name="Okoye", email="zephyr@example.com")
    contract = make_contract(db_session, org)

    upload_res = client.post(
        f"/contracts/{contract.id}/documents",
        data={"title": "Zephyr Filing"},
        files={"file": ("zephyr.pdf", b"%PDF-1.4 fake", "application/pdf")},
        headers=auth_headers(admin),
    )
    assert upload_res.status_code == 201

    res = client.get("/search?q=Zephyr", headers=auth_headers(admin))
    assert res.status_code == 200
    body = res.json()
    assert any(s["id"] == str(lawyer.id) for s in body["staff"])
    assert any(d["title"] == "Zephyr Filing" for d in body["documents"])
