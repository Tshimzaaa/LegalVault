"""
Matter status transition rules + the approval gate on awaiting_signature -> signed and
signed -> closed. See MATTER_STATUS_TRANSITIONS / GATED_TRANSITIONS in
app/modules/matters/service.py for the graph these tests exercise.
"""
from app.modules.auth.models.role import UserRole
from tests.conftest import TwoOrgs, auth_headers, make_client_company, make_org, make_matter, make_staff


def _advance_to_awaiting_signature(client, matter_id, admin):
    client.patch(f"/matters/{matter_id}/status", json={"status": "in_review"}, headers=auth_headers(admin))
    client.patch(
        f"/matters/{matter_id}/status", json={"status": "awaiting_signature"}, headers=auth_headers(admin)
    )


def test_invalid_transition_rejected(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    client_company = make_client_company(db_session, org)
    matter = make_matter(db_session, org, client_company)  # status: intake

    res = client.patch(f"/matters/{matter.id}/status", json={"status": "signed"}, headers=auth_headers(admin))
    assert res.status_code == 409


def test_same_status_is_a_noop(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    client_company = make_client_company(db_session, org)
    matter = make_matter(db_session, org, client_company)

    res = client.patch(f"/matters/{matter.id}/status", json={"status": "intake"}, headers=auth_headers(admin))
    assert res.status_code == 200
    assert res.json()["status"] == "intake"


def test_gated_transition_rejected_via_direct_patch(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    client_company = make_client_company(db_session, org)
    matter = make_matter(db_session, org, client_company)
    _advance_to_awaiting_signature(client, matter.id, admin)

    res = client.patch(f"/matters/{matter.id}/status", json={"status": "signed"}, headers=auth_headers(admin))
    assert res.status_code == 409


def test_request_approval_creates_pending_and_notifies_eligible_approvers(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org, email="admin@example.com")
    lawyer, _ = make_staff(db_session, org, email="lawyer@example.com")
    paralegal, _ = make_staff(db_session, org, email="paralegal@example.com", role=UserRole.PARALEGAL)
    client_company = make_client_company(db_session, org)
    matter = make_matter(db_session, org, client_company)
    _advance_to_awaiting_signature(client, matter.id, admin)

    client.post(
        f"/matters/{matter.id}/assignments",
        json={"user_id": str(lawyer.id), "role_on_matter": "lead_lawyer"},
        headers=auth_headers(admin),
    )

    res = client.post(
        f"/matters/{matter.id}/approvals", json={"to_status": "signed"}, headers=auth_headers(paralegal)
    )
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "pending"
    assert body["from_status"] == "awaiting_signature"
    assert body["to_status"] == "signed"

    # matter status hasn't moved yet — still pending
    get_res = client.get(f"/matters/{matter.id}", headers=auth_headers(admin))
    assert get_res.json()["status"] == "awaiting_signature"

    admin_notifs = client.get("/notifications", headers=auth_headers(admin)).json()
    assert any(n["type"] == "matter.approval_requested" for n in admin_notifs)

    lawyer_notifs = client.get("/notifications", headers=auth_headers(lawyer)).json()
    assert any(n["type"] == "matter.approval_requested" for n in lawyer_notifs)

    # requester doesn't notify themselves
    paralegal_notifs = client.get("/notifications", headers=auth_headers(paralegal)).json()
    assert not any(n["type"] == "matter.approval_requested" for n in paralegal_notifs)


def test_duplicate_pending_request_rejected(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    client_company = make_client_company(db_session, org)
    matter = make_matter(db_session, org, client_company)
    _advance_to_awaiting_signature(client, matter.id, admin)

    first = client.post(
        f"/matters/{matter.id}/approvals", json={"to_status": "signed"}, headers=auth_headers(admin)
    )
    assert first.status_code == 201

    second = client.post(
        f"/matters/{matter.id}/approvals", json={"to_status": "signed"}, headers=auth_headers(admin)
    )
    assert second.status_code == 409


def test_decide_approve_applies_status_and_notifies_requester(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org, email="admin@example.com")
    paralegal, _ = make_staff(db_session, org, email="paralegal@example.com", role=UserRole.PARALEGAL)
    client_company = make_client_company(db_session, org)
    matter = make_matter(db_session, org, client_company)
    _advance_to_awaiting_signature(client, matter.id, admin)

    approval = client.post(
        f"/matters/{matter.id}/approvals", json={"to_status": "signed"}, headers=auth_headers(paralegal)
    ).json()

    decide_res = client.patch(
        f"/matters/{matter.id}/approvals/{approval['id']}",
        json={"decision": "approved", "note": "looks good"},
        headers=auth_headers(admin),
    )
    assert decide_res.status_code == 200
    assert decide_res.json()["status"] == "approved"

    get_res = client.get(f"/matters/{matter.id}", headers=auth_headers(admin))
    assert get_res.json()["status"] == "signed"

    paralegal_notifs = client.get("/notifications", headers=auth_headers(paralegal)).json()
    assert any(n["type"] == "matter.approval_decided" for n in paralegal_notifs)


def test_decide_reject_leaves_status_untouched(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    client_company = make_client_company(db_session, org)
    matter = make_matter(db_session, org, client_company)
    _advance_to_awaiting_signature(client, matter.id, admin)

    approval = client.post(
        f"/matters/{matter.id}/approvals", json={"to_status": "signed"}, headers=auth_headers(admin)
    ).json()

    decide_res = client.patch(
        f"/matters/{matter.id}/approvals/{approval['id']}",
        json={"decision": "rejected"},
        headers=auth_headers(admin),
    )
    assert decide_res.status_code == 200
    assert decide_res.json()["status"] == "rejected"

    get_res = client.get(f"/matters/{matter.id}", headers=auth_headers(admin))
    assert get_res.json()["status"] == "awaiting_signature"


def test_already_decided_approval_rejected(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    client_company = make_client_company(db_session, org)
    matter = make_matter(db_session, org, client_company)
    _advance_to_awaiting_signature(client, matter.id, admin)

    approval = client.post(
        f"/matters/{matter.id}/approvals", json={"to_status": "signed"}, headers=auth_headers(admin)
    ).json()
    client.patch(
        f"/matters/{matter.id}/approvals/{approval['id']}",
        json={"decision": "approved"},
        headers=auth_headers(admin),
    )

    second_decide = client.patch(
        f"/matters/{matter.id}/approvals/{approval['id']}",
        json={"decision": "rejected"},
        headers=auth_headers(admin),
    )
    assert second_decide.status_code == 409


def test_non_eligible_actor_cannot_decide(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org, email="admin@example.com")
    requester, _ = make_staff(db_session, org, email="requester@example.com", role=UserRole.PARALEGAL)
    other_paralegal, _ = make_staff(db_session, org, email="other@example.com", role=UserRole.PARALEGAL)
    client_company = make_client_company(db_session, org)
    matter = make_matter(db_session, org, client_company)
    _advance_to_awaiting_signature(client, matter.id, admin)

    approval = client.post(
        f"/matters/{matter.id}/approvals", json={"to_status": "signed"}, headers=auth_headers(requester)
    ).json()

    # other_paralegal passes the route-level role check (paralegal is case-work) but isn't
    # admin and isn't this matter's lead lawyer — the service-level eligibility check.
    decide_res = client.patch(
        f"/matters/{matter.id}/approvals/{approval['id']}",
        json={"decision": "approved"},
        headers=auth_headers(other_paralegal),
    )
    assert decide_res.status_code == 403

    get_res = client.get(f"/matters/{matter.id}", headers=auth_headers(admin))
    assert get_res.json()["status"] == "awaiting_signature"


def test_assigned_lead_lawyer_can_decide(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org, email="admin@example.com")
    lawyer, _ = make_staff(db_session, org, email="lawyer@example.com")
    client_company = make_client_company(db_session, org)
    matter = make_matter(db_session, org, client_company)
    _advance_to_awaiting_signature(client, matter.id, admin)
    client.post(
        f"/matters/{matter.id}/assignments",
        json={"user_id": str(lawyer.id), "role_on_matter": "lead_lawyer"},
        headers=auth_headers(admin),
    )

    approval = client.post(
        f"/matters/{matter.id}/approvals", json={"to_status": "signed"}, headers=auth_headers(admin)
    ).json()

    decide_res = client.patch(
        f"/matters/{matter.id}/approvals/{approval['id']}",
        json={"decision": "approved"},
        headers=auth_headers(lawyer),
    )
    assert decide_res.status_code == 200


def test_pending_approvals_scoped_to_org(client, db_session):
    tf = TwoOrgs(db_session)
    _advance_to_awaiting_signature(client, tf.matter_a.id, tf.staff_a)
    client.post(
        f"/matters/{tf.matter_a.id}/approvals", json={"to_status": "signed"}, headers=auth_headers(tf.staff_a)
    )

    org_a_pending = client.get("/matters/approvals/pending", headers=auth_headers(tf.staff_a)).json()
    assert len(org_a_pending) == 1
    assert org_a_pending[0]["matter_id"] == str(tf.matter_a.id)

    org_b_pending = client.get("/matters/approvals/pending", headers=auth_headers(tf.staff_b)).json()
    assert org_b_pending == []
