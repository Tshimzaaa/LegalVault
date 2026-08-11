"""
The single most important property this app has to guarantee: firm A can
never see, list, or modify firm B's data through any staff-facing endpoint,
and "can't see it" always surfaces as 404 (not 403) — an attacker shouldn't
even learn the resource exists under someone else's firm.
"""
from tests.conftest import auth_headers, make_matter


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
