"""
The single most important property this app has to guarantee: org A can
never see, list, or modify org B's data through any staff-facing endpoint,
and "can't see it" always surfaces as 404 (not 403) — an attacker shouldn't
even learn the resource exists under someone else's org.
"""
from app.modules.knowledge.models import KnowledgeArticle
from app.modules.notifications.models import Notification, RecipientType
from tests.conftest import (
    auth_headers,
    make_contract,
    make_signed_contract,
)


def test_staff_cannot_get_another_orgs_contract_by_id(client, two_orgs):
    res = client.get(f"/contracts/{two_orgs.contract_a.id}", headers=auth_headers(two_orgs.staff_b))
    assert res.status_code == 404


def test_staff_list_contracts_only_returns_own_org(client, two_orgs):
    res = client.get("/contracts", headers=auth_headers(two_orgs.staff_b))
    assert res.status_code == 200
    contract_ids = {m["id"] for m in res.json()}
    assert str(two_orgs.contract_a.id) not in contract_ids
    assert str(two_orgs.contract_b.id) in contract_ids


def test_staff_cannot_update_another_orgs_contract_status(client, two_orgs):
    res = client.patch(
        f"/contracts/{two_orgs.contract_a.id}/status",
        json={"status": "closed"},
        headers=auth_headers(two_orgs.staff_b),
    )
    assert res.status_code == 404


def test_nested_contract_resource_inherits_isolation(client, db_session, two_orgs):
    # Tasks/documents/messages all resolve their parent contract (and its org_id) first —
    # this proves that check actually blocks cross-org access for a nested resource too,
    # not just top-level contract routes.
    res = client.post(
        f"/contracts/{two_orgs.contract_a.id}/tasks",
        json={"title": "Should not be creatable"},
        headers=auth_headers(two_orgs.staff_b),
    )
    assert res.status_code == 404


def test_staff_cannot_download_another_orgs_template(client, db_session, two_orgs):
    from app.modules.templates.models import Template

    template = Template(
        org_id=two_orgs.org_a.id,
        title="Org A Only",
        category="Confidentiality",
        file_key="templates/does-not-contract-for-this-test",
        original_filename="nda.pdf",
        content_type="application/pdf",
        version=1,
    )
    db_session.add(template)
    db_session.flush()

    res = client.get(f"/templates/{template.id}/download", headers=auth_headers(two_orgs.staff_b))
    assert res.status_code == 404


# ---- adversarial pass: this session's new features, plus modules that had no
# explicit cross-org test before ------------------------------------------------


def _advance_to_awaiting_signature(client, contract_id, staff):
    client.patch(f"/contracts/{contract_id}/status", json={"status": "in_review"}, headers=auth_headers(staff))
    client.patch(f"/contracts/{contract_id}/status", json={"status": "awaiting_signature"}, headers=auth_headers(staff))


def test_staff_cannot_view_or_act_on_another_orgs_contract_approvals(client, db_session, two_orgs):
    _advance_to_awaiting_signature(client, two_orgs.contract_a.id, two_orgs.staff_a)
    approval = client.post(
        f"/contracts/{two_orgs.contract_a.id}/approvals",
        json={"to_status": "signed"},
        headers=auth_headers(two_orgs.staff_a),
    ).json()

    list_res = client.get(f"/contracts/{two_orgs.contract_a.id}/approvals", headers=auth_headers(two_orgs.staff_b))
    assert list_res.status_code == 404

    request_res = client.post(
        f"/contracts/{two_orgs.contract_a.id}/approvals",
        json={"to_status": "closed"},
        headers=auth_headers(two_orgs.staff_b),
    )
    assert request_res.status_code == 404

    decide_res = client.patch(
        f"/contracts/{two_orgs.contract_a.id}/approvals/{approval['id']}",
        json={"decision": "approved"},
        headers=auth_headers(two_orgs.staff_b),
    )
    assert decide_res.status_code == 404


def test_staff_cannot_download_or_update_another_orgs_signed_contract(client, db_session, two_orgs):
    contract = make_signed_contract(db_session, two_orgs.org_a)

    download_res = client.get(
        f"/signed-contracts/{contract.id}/download", headers=auth_headers(two_orgs.staff_b)
    )
    assert download_res.status_code == 404

    status_res = client.patch(
        f"/signed-contracts/{contract.id}/status",
        json={"status": "archived"},
        headers=auth_headers(two_orgs.staff_b),
    )
    assert status_res.status_code == 404


def test_staff_cannot_mark_another_orgs_staff_notification_read(client, db_session, two_orgs):
    notification = Notification(
        recipient_type=RecipientType.STAFF,
        recipient_id=two_orgs.staff_a.id,
        type="contract.staff_assigned",
        title="Org A only",
        body="Should not be reachable by org B.",
    )
    db_session.add(notification)
    db_session.flush()

    res = client.patch(f"/notifications/{notification.id}/read", headers=auth_headers(two_orgs.staff_b))
    assert res.status_code == 404


def test_staff_cannot_view_or_modify_another_orgs_knowledge_article(client, db_session, two_orgs):
    article = KnowledgeArticle(
        org_id=two_orgs.org_a.id,
        title="Org A internal only",
        category="Glossary",
        content="Should not leak.",
        is_published=True,
    )
    db_session.add(article)
    db_session.flush()

    get_res = client.get(f"/knowledge-articles/{article.id}", headers=auth_headers(two_orgs.staff_b))
    assert get_res.status_code == 404

    patch_res = client.patch(
        f"/knowledge-articles/{article.id}", json={"title": "Hijacked"}, headers=auth_headers(two_orgs.staff_b)
    )
    assert patch_res.status_code == 404

    delete_res = client.delete(f"/knowledge-articles/{article.id}", headers=auth_headers(two_orgs.staff_b))
    assert delete_res.status_code == 404


def test_search_never_returns_another_orgs_results(client, db_session, two_orgs):
    make_contract(db_session, two_orgs.org_a, title="Unique Zylophone Merger")

    res = client.get("/search?q=Zylophone", headers=auth_headers(two_orgs.staff_b))
    assert res.status_code == 200
    assert res.json()["contracts"] == []


def test_audit_log_never_leaks_another_orgs_entries(client, db_session, two_orgs):
    # Perform an auditable action as org A, then confirm org B's audit log never
    # shows it — list_audit_log is org-scoped by the repository, not by RLS alone.
    client.patch(
        f"/contracts/{two_orgs.contract_a.id}",
        json={"title": "Renamed by org A", "description": None},
        headers=auth_headers(two_orgs.staff_a),
    )

    res = client.get("/audit-log", headers=auth_headers(two_orgs.staff_b))
    assert res.status_code == 200
    assert all(entry["org_id"] != str(two_orgs.org_a.id) for entry in res.json())
