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


def test_client_submits_other_request_type_with_uploaded_document(client, db_session, monkeypatch):
    monkeypatch.setattr("app.modules.intake.service.scan_file", lambda *a, **k: None)
    monkeypatch.setattr("app.modules.intake.service.upload_file", lambda *a, **k: "intake/fake-key")

    firm = make_firm(db_session)
    seed_system_support_form(db_session, firm.id)
    client_company = make_client_company(db_session, firm)
    contact, _ = make_contact(db_session, client_company)

    form = client.get("/client-intake/forms", headers=auth_headers(contact)).json()[0]
    assert "Other" in next(f for f in form["fields"] if f["key"] == "request_type")["options"]

    request_type_field_id = _request_type_field_id(form)
    other_field_id = next(f["id"] for f in form["fields"] if f["key"] == "other_request_type")
    description_field_id = next(f["id"] for f in form["fields"] if f["key"] == "description")
    upload_field_id = next(f["id"] for f in form["fields"] if f["key"] == "reference_document_upload")

    create_res = client.post(
        f"/client-intake/forms/{form['id']}/submit",
        data={
            "answers_json": (
                f'{{"{request_type_field_id}": "Other", '
                f'"{other_field_id}": "Trademark opposition", '
                f'"{description_field_id}": "Need help opposing a trademark filing."}}'
            ),
            "file_field_ids": [upload_field_id],
        },
        files={"files": ("evidence.pdf", b"fake pdf content", "application/pdf")},
        headers=auth_headers(contact),
    )
    assert create_res.status_code == 201
    answers = {a["field_id"]: a for a in create_res.json()["answers"]}
    assert answers[other_field_id]["value"] == "Trademark opposition"
    assert answers[upload_field_id]["original_filename"] == "evidence.pdf"


def test_staff_can_list_and_get_the_system_form_read_only(client, db_session):
    # There's no form builder — every firm has exactly the one system-seeded form, and
    # staff can only read it (to label submission answers), never create/edit/delete it.
    firm = make_firm(db_session)
    seed_system_support_form(db_session, firm.id)
    admin, _ = make_staff(db_session, firm)

    list_res = client.get("/intake-forms", headers=auth_headers(admin))
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1
    assert list_res.json()[0]["is_system"] is True

    get_res = client.get(f"/intake-forms/{list_res.json()[0]['id']}", headers=auth_headers(admin))
    assert get_res.status_code == 200
