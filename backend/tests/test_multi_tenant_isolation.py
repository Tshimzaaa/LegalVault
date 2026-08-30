"""
The single most important property this app has to guarantee: firm A can
never see, list, or modify firm B's data through any staff-facing endpoint,
and "can't see it" always surfaces as 404 (not 403) — an attacker shouldn't
even learn the resource exists under someone else's firm.
"""
from app.modules.knowledge.models import KnowledgeArticle
from app.modules.notifications.models import Notification, RecipientType
from tests.conftest import (
    auth_headers,
    make_contact,
    make_matter,
    make_signed_contract,
)
from tests.test_document_generation import (
    make_answer,
    make_intake_field,
    make_intake_form,
    make_intake_submission,
    make_template,
)


def test_staff_cannot_get_another_firms_matter_by_id(client, two_firms):
    res = client.get(f"/matters/{two_firms.matter_a.id}", headers=auth_headers(two_firms.staff_b))
    assert res.status_code == 404


def test_staff_list_matters_only_returns_own_firm(client, two_firms):
    res = client.get("/matters", headers=auth_headers(two_firms.staff_b))
    assert res.status_code == 200
    matter_ids = {m["id"] for m in res.json()}
    assert str(two_firms.matter_a.id) not in matter_ids
    assert str(two_firms.matter_b.id) in matter_ids


def test_staff_cannot_update_another_firms_matter_status(client, two_firms):
    res = client.patch(
        f"/matters/{two_firms.matter_a.id}/status",
        json={"status": "closed"},
        headers=auth_headers(two_firms.staff_b),
    )
    assert res.status_code == 404


def test_staff_list_clients_only_returns_own_firm(client, two_firms):
    res = client.get("/clients", headers=auth_headers(two_firms.staff_b))
    assert res.status_code == 200
    client_ids = {c["id"] for c in res.json()}
    assert str(two_firms.client_a.id) not in client_ids
    assert str(two_firms.client_b.id) in client_ids


def test_staff_cannot_deactivate_another_firms_client(client, two_firms):
    res = client.patch(
        f"/clients/{two_firms.client_a.id}/status",
        json={"is_active": False},
        headers=auth_headers(two_firms.staff_b),
    )
    assert res.status_code == 404


def test_nested_matter_resource_inherits_isolation(client, db_session, two_firms):
    # Tasks/documents/messages all resolve their parent matter (and its firm_id) first —
    # this proves that check actually blocks cross-firm access for a nested resource too,
    # not just top-level matter routes.
    res = client.post(
        f"/matters/{two_firms.matter_a.id}/tasks",
        json={"title": "Should not be creatable"},
        headers=auth_headers(two_firms.staff_b),
    )
    assert res.status_code == 404


def test_staff_cannot_download_another_firms_template(client, db_session, two_firms):
    from app.modules.templates.models import Template

    template = Template(
        firm_id=two_firms.firm_a.id,
        title="Firm A Only",
        category="Confidentiality",
        file_key="templates/does-not-matter-for-this-test",
        original_filename="nda.pdf",
        content_type="application/pdf",
        version=1,
    )
    db_session.add(template)
    db_session.flush()

    res = client.get(f"/templates/{template.id}/download", headers=auth_headers(two_firms.staff_b))
    assert res.status_code == 404


def test_client_contact_cannot_see_another_firms_matter(client, db_session, two_firms):
    from tests.conftest import make_contact

    contact_b, password_b = make_contact(db_session, two_firms.client_b)
    # Make matter_a visible to its own client so the only thing standing between
    # contact_b and it is firm isolation, not the visibility flag.
    two_firms.matter_a.is_visible_to_client = True
    db_session.flush()

    res = client.get(f"/client-matters/{two_firms.matter_a.id}/documents", headers=auth_headers(contact_b))
    assert res.status_code == 404


# ---- adversarial pass: this session's new features, plus modules that had no
# explicit cross-firm test before ------------------------------------------------


def _advance_to_awaiting_signature(client, matter_id, staff):
    client.patch(f"/matters/{matter_id}/status", json={"status": "in_review"}, headers=auth_headers(staff))
    client.patch(f"/matters/{matter_id}/status", json={"status": "awaiting_signature"}, headers=auth_headers(staff))


def test_staff_cannot_view_or_act_on_another_firms_matter_approvals(client, db_session, two_firms):
    _advance_to_awaiting_signature(client, two_firms.matter_a.id, two_firms.staff_a)
    approval = client.post(
        f"/matters/{two_firms.matter_a.id}/approvals",
        json={"to_status": "signed"},
        headers=auth_headers(two_firms.staff_a),
    ).json()

    list_res = client.get(f"/matters/{two_firms.matter_a.id}/approvals", headers=auth_headers(two_firms.staff_b))
    assert list_res.status_code == 404

    request_res = client.post(
        f"/matters/{two_firms.matter_a.id}/approvals",
        json={"to_status": "closed"},
        headers=auth_headers(two_firms.staff_b),
    )
    assert request_res.status_code == 404

    decide_res = client.patch(
        f"/matters/{two_firms.matter_a.id}/approvals/{approval['id']}",
        json={"decision": "approved"},
        headers=auth_headers(two_firms.staff_b),
    )
    assert decide_res.status_code == 404


def test_generate_document_rejects_template_from_another_firm(client, db_session, two_firms, monkeypatch):
    monkeypatch.setattr("app.modules.matters.service.upload_file", lambda *a, **k: "matter_documents/fake-key")
    monkeypatch.setattr("app.modules.matters.service.scan_file", lambda *a, **k: None)

    foreign_template = make_template(db_session, two_firms.firm_b, body="Hello {{client_name}}.")
    contact_a, _ = make_contact(db_session, two_firms.client_a)
    form_a = make_intake_form(db_session, two_firms.firm_a)
    submission_a = make_intake_submission(db_session, two_firms.firm_a, form_a, two_firms.client_a, contact_a)

    res = client.post(
        f"/matters/{two_firms.matter_a.id}/documents/generate",
        json={"template_id": str(foreign_template.id), "intake_submission_id": str(submission_a.id)},
        headers=auth_headers(two_firms.staff_a),
    )
    assert res.status_code == 404


def test_generate_document_rejects_intake_submission_from_another_firm(client, db_session, two_firms, monkeypatch):
    monkeypatch.setattr("app.modules.matters.service.upload_file", lambda *a, **k: "matter_documents/fake-key")
    monkeypatch.setattr("app.modules.matters.service.scan_file", lambda *a, **k: None)

    template_a = make_template(db_session, two_firms.firm_a, body="Hello {{client_name}}.")
    contact_b, _ = make_contact(db_session, two_firms.client_b)
    form_b = make_intake_form(db_session, two_firms.firm_b)
    foreign_submission = make_intake_submission(db_session, two_firms.firm_b, form_b, two_firms.client_b, contact_b)

    res = client.post(
        f"/matters/{two_firms.matter_a.id}/documents/generate",
        json={"template_id": str(template_a.id), "intake_submission_id": str(foreign_submission.id)},
        headers=auth_headers(two_firms.staff_a),
    )
    assert res.status_code == 404


def test_staff_cannot_download_or_update_another_firms_signed_contract(client, db_session, two_firms):
    contract = make_signed_contract(db_session, two_firms.firm_a, two_firms.client_a)

    download_res = client.get(
        f"/signed-contracts/{contract.id}/download", headers=auth_headers(two_firms.staff_b)
    )
    assert download_res.status_code == 404

    status_res = client.patch(
        f"/signed-contracts/{contract.id}/status",
        json={"status": "archived"},
        headers=auth_headers(two_firms.staff_b),
    )
    assert status_res.status_code == 404


def test_staff_cannot_mark_another_firms_staff_notification_read(client, db_session, two_firms):
    notification = Notification(
        recipient_type=RecipientType.STAFF,
        recipient_id=two_firms.staff_a.id,
        type="matter.staff_assigned",
        title="Firm A only",
        body="Should not be reachable by firm B.",
    )
    db_session.add(notification)
    db_session.flush()

    res = client.patch(f"/notifications/{notification.id}/read", headers=auth_headers(two_firms.staff_b))
    assert res.status_code == 404


def test_staff_cannot_view_or_convert_another_firms_intake_submission(client, db_session, two_firms):
    contact_a, _ = make_contact(db_session, two_firms.client_a)
    form_a = make_intake_form(db_session, two_firms.firm_a)
    submission_a = make_intake_submission(db_session, two_firms.firm_a, form_a, two_firms.client_a, contact_a)

    get_res = client.get(f"/intake-submissions/{submission_a.id}", headers=auth_headers(two_firms.staff_b))
    assert get_res.status_code == 404

    convert_res = client.post(
        f"/intake-submissions/{submission_a.id}/convert", json={}, headers=auth_headers(two_firms.staff_b)
    )
    assert convert_res.status_code == 404


def test_staff_cannot_view_or_modify_another_firms_knowledge_article(client, db_session, two_firms):
    article = KnowledgeArticle(
        firm_id=two_firms.firm_a.id,
        title="Firm A internal only",
        category="Glossary",
        content="Should not leak.",
        is_published=True,
    )
    db_session.add(article)
    db_session.flush()

    get_res = client.get(f"/knowledge-articles/{article.id}", headers=auth_headers(two_firms.staff_b))
    assert get_res.status_code == 404

    patch_res = client.patch(
        f"/knowledge-articles/{article.id}", json={"title": "Hijacked"}, headers=auth_headers(two_firms.staff_b)
    )
    assert patch_res.status_code == 404

    delete_res = client.delete(f"/knowledge-articles/{article.id}", headers=auth_headers(two_firms.staff_b))
    assert delete_res.status_code == 404


def test_staff_cannot_manage_another_firms_matter_contact_permissions(client, db_session, two_firms):
    contact_a, _ = make_contact(db_session, two_firms.client_a)

    list_res = client.get(
        f"/matters/{two_firms.matter_a.id}/contact-permissions", headers=auth_headers(two_firms.staff_b)
    )
    assert list_res.status_code == 404

    set_res = client.post(
        f"/matters/{two_firms.matter_a.id}/contact-permissions",
        json={"client_contact_id": str(contact_a.id), "permission_level": "viewer"},
        headers=auth_headers(two_firms.staff_b),
    )
    assert set_res.status_code == 404


def test_search_never_returns_another_firms_results(client, db_session, two_firms):
    make_matter(db_session, two_firms.firm_a, two_firms.client_a, title="Unique Zylophone Merger")

    res = client.get("/search?q=Zylophone", headers=auth_headers(two_firms.staff_b))
    assert res.status_code == 200
    assert res.json()["matters"] == []


def test_audit_log_never_leaks_another_firms_entries(client, db_session, two_firms):
    # Perform an auditable action as firm A, then confirm firm B's audit log never
    # shows it — list_audit_log is firm-scoped by the repository, not by RLS alone.
    client.patch(
        f"/matters/{two_firms.matter_a.id}",
        json={"title": "Renamed by firm A", "description": None},
        headers=auth_headers(two_firms.staff_a),
    )

    res = client.get("/audit-log", headers=auth_headers(two_firms.staff_b))
    assert res.status_code == 200
    assert all(entry["firm_id"] != str(two_firms.firm_a.id) for entry in res.json())
