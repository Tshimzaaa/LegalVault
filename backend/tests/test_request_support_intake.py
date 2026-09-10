"""
Request Support was merged into the intake-submission system (see
app.modules.intake.system_forms) — a client's "request support" is now just
a submission against the per-firm system-seeded "Request Support" intake
form. This covers the client submitting against that form, staff triaging
it through the unified intake inbox, and the merged status vocabulary
(including the new `resolved` status carried over from the old feature).
"""
from app.modules.intake.system_forms import seed_system_support_form
from tests.conftest import auth_headers, make_client_company, make_contact, make_firm, make_staff


def _request_type_field_id(form_json: dict) -> str:
    return next(f["id"] for f in form_json["fields"] if f["key"] == "request_type")


def test_client_submits_request_support_form_and_staff_can_see_it(client, db_session):
    firm = make_firm(db_session)
    seed_system_support_form(db_session, firm.id)
    admin, _ = make_staff(db_session, firm)
    client_company = make_client_company(db_session, firm)
    contact, _ = make_contact(db_session, client_company)

    forms_res = client.get("/client-intake/forms", headers=auth_headers(contact))
    assert forms_res.status_code == 200
    forms = forms_res.json()
    assert len(forms) == 1
    form = forms[0]
    assert form["is_system"] is True
    assert form["title"] == "Request Support"

    request_type_field_id = _request_type_field_id(form)
    description_field_id = next(f["id"] for f in form["fields"] if f["key"] == "description")

    create_res = client.post(
        f"/client-intake/forms/{form['id']}/submit",
        data={
            "answers_json": (
                f'{{"{request_type_field_id}": "NDA Review", '
                f'"{description_field_id}": "Please review this NDA before we sign."}}'
            )
        },
        headers=auth_headers(contact),
    )
    assert create_res.status_code == 201
    assert create_res.json()["status"] == "submitted"

    mine_res = client.get("/client-intake/submissions", headers=auth_headers(contact))
    assert mine_res.status_code == 200
    assert len(mine_res.json()) == 1

    staff_res = client.get("/intake-submissions", headers=auth_headers(admin))
    assert staff_res.status_code == 200
    assert len(staff_res.json()) == 1


def test_staff_resolves_request_support_submission(client, db_session):
    firm = make_firm(db_session)
    seed_system_support_form(db_session, firm.id)
    admin, _ = make_staff(db_session, firm)
    client_company = make_client_company(db_session, firm)
    contact, _ = make_contact(db_session, client_company)

    form = client.get("/client-intake/forms", headers=auth_headers(contact)).json()[0]
    request_type_field_id = _request_type_field_id(form)
    description_field_id = next(f["id"] for f in form["fields"] if f["key"] == "description")

    submission_id = client.post(
        f"/client-intake/forms/{form['id']}/submit",
        data={
            "answers_json": (
                f'{{"{request_type_field_id}": "General Inquiry", '
                f'"{description_field_id}": "Quick question about our engagement letter."}}'
            )
        },
        headers=auth_headers(contact),
    ).json()["id"]

    res = client.patch(
        f"/intake-submissions/{submission_id}/status", json={"status": "resolved"}, headers=auth_headers(admin)
    )
    assert res.status_code == 200
    assert res.json()["status"] == "resolved"


def test_staff_cannot_delete_or_add_fields_to_system_form(client, db_session):
    firm = make_firm(db_session)
    seed_system_support_form(db_session, firm.id)
    admin, _ = make_staff(db_session, firm)

    form_id = client.get("/intake-forms", headers=auth_headers(admin)).json()[0]["id"]

    add_res = client.post(
        f"/intake-forms/{form_id}/fields",
        json={"label": "Extra Field", "field_type": "text"},
        headers=auth_headers(admin),
    )
    assert add_res.status_code == 409

    delete_res = client.delete(f"/intake-forms/{form_id}", headers=auth_headers(admin))
    assert delete_res.status_code == 409


def test_staff_can_delete_a_custom_form_with_fields(client, db_session):
    # Regression test: IntakeForm.fields has no ORM delete cascade, so deleting a form
    # used to try nulling out each field's non-nullable form_id — which also violates
    # the RLS policy on intake_form_fields — and 500'd on any form that had fields.
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)

    form_id = client.post(
        "/intake-forms", json={"title": "Custom Intake"}, headers=auth_headers(admin)
    ).json()["id"]
    client.post(
        f"/intake-forms/{form_id}/fields",
        json={"label": "Full name", "field_type": "text"},
        headers=auth_headers(admin),
    )

    delete_res = client.delete(f"/intake-forms/{form_id}", headers=auth_headers(admin))
    assert delete_res.status_code == 204

    list_res = client.get("/intake-forms", headers=auth_headers(admin))
    assert all(f["id"] != form_id for f in list_res.json())


def test_intake_field_display_order_increments(client, db_session):
    # Regression test: max_display_order() used a func.max() aggregate that was
    # observed always returning NULL under this app's RLS setup, so every new field
    # landed at display_order 0 instead of incrementing. Fixed by deriving the max
    # from the same row-select list_fields_by_form already uses successfully.
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)

    form_id = client.post(
        "/intake-forms", json={"title": "Order Test"}, headers=auth_headers(admin)
    ).json()["id"]

    orders = []
    for label in ("Field A", "Field B", "Field C"):
        res = client.post(
            f"/intake-forms/{form_id}/fields",
            json={"label": label, "field_type": "text"},
            headers=auth_headers(admin),
        )
        orders.append(res.json()["display_order"])

    assert orders == [0, 1, 2]
