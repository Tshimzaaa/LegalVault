"""
Signed contracts: upload, list, summary, download, and archive/reactivate
status. Upload goes through R2 + the malware scanner, so both are stubbed.
"""
import pytest

from tests.conftest import auth_headers, make_client_company, make_firm, make_staff


@pytest.fixture(autouse=True)
def _stub_r2_and_scanner(monkeypatch):
    monkeypatch.setattr("app.modules.signed_contracts.service.upload_file", lambda *a, **k: "signed_contracts/fake-key")
    monkeypatch.setattr("app.modules.signed_contracts.service.get_download_url", lambda *a, **k: "https://example.com/fake-url")
    monkeypatch.setattr("app.modules.signed_contracts.service.scan_file", lambda *a, **k: None)


def _upload(client, admin, client_company, **overrides):
    return client.post(
        "/signed-contracts",
        data={
            "client_id": str(client_company.id),
            "title": overrides.get("title", "Master Services Agreement"),
            "agreement_type": overrides.get("agreement_type", "nda"),
            "signed_date": overrides.get("signed_date", "2026-01-01"),
        },
        files={"file": ("agreement.pdf", b"fake pdf content", "application/pdf")},
        headers=auth_headers(admin),
    )


def test_upload_and_list_signed_contract(client, db_session):
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    client_company = make_client_company(db_session, firm)

    upload_res = _upload(client, admin, client_company)
    assert upload_res.status_code == 201
    assert upload_res.json()["status"] == "active"

    list_res = client.get("/signed-contracts", headers=auth_headers(admin))
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1

    summary_res = client.get("/signed-contracts/summary", headers=auth_headers(admin))
    assert summary_res.status_code == 200
    assert summary_res.json()["total"] == 1
    assert summary_res.json()["active"] == 1


def test_download_and_archive_signed_contract(client, db_session):
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    client_company = make_client_company(db_session, firm)
    contract_id = _upload(client, admin, client_company).json()["id"]

    download_res = client.get(f"/signed-contracts/{contract_id}/download", headers=auth_headers(admin))
    assert download_res.status_code == 200
    assert download_res.json()["download_url"]

    archive_res = client.patch(
        f"/signed-contracts/{contract_id}/status", json={"status": "archived"}, headers=auth_headers(admin)
    )
    assert archive_res.status_code == 200
    assert archive_res.json()["status"] == "archived"

    reactivate_res = client.patch(
        f"/signed-contracts/{contract_id}/status", json={"status": "active"}, headers=auth_headers(admin)
    )
    assert reactivate_res.status_code == 200
    assert reactivate_res.json()["status"] == "active"
