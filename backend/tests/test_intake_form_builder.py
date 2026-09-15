"""
Intake form builder: staff can create/edit/delete/publish custom intake forms
and their fields; the system-seeded "Contract Request" form stays protected.
Any staff member can submit a request; builder roles (admin/lawyer) triage it.
"""
from app.modules.intake.system_forms import seed_system_support_form
from tests.conftest import auth_headers, make_org, make_staff


def _create_form(client, admin, **overrides):
    return client.post(
        "/intake-forms",
        json={
            "title": overrides.get("title", "NDA Request"),
            "description": overrides.get("description", "Request a standard NDA."),
        },
        headers=auth_headers(admin),
    )


def test_create_form_and_add_field(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)

    form_res = _create_form(client, admin)
    assert form_res.status_code == 201
    form = form_res.json()
    assert form["is_published"] is False
    assert form["is_system"] is False

    field_res = client.post(
        f"/intake-forms/{form['id']}/fields",
        json={"label": "Counterparty name", "field_type": "text", "is_required": True},
        headers=auth_headers(admin),
    )
    assert field_res.status_code == 201
    assert field_res.json()["display_order"] == 0

    second_field_res = client.post(
        f"/intake-forms/{form['id']}/fields",
        json={"label": "Deal type", "field_type": "dropdown", "options": ["Buy-side", "Sell-side"]},
        headers=auth_headers(admin),
    )
    assert second_field_res.json()["display_order"] == 1


def test_update_field_and_reorder(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    form = _create_form(client, admin).json()

    field_a = client.post(
        f"/intake-forms/{form['id']}/fields",
        json={"label": "Field A", "field_type": "text"},
        headers=auth_headers(admin),
    ).json()
    field_b = client.post(
        f"/intake-forms/{form['id']}/fields",
        json={"label": "Field B", "field_type": "text"},
        headers=auth_headers(admin),
    ).json()

    update_res = client.patch(
        f"/intake-forms/{form['id']}/fields/{field_a['id']}",
        json={"label": "Field A (renamed)", "is_required": True},
        headers=auth_headers(admin),
    )
    assert update_res.status_code == 200
    assert update_res.json()["label"] == "Field A (renamed)"

    reorder_res = client.patch(
        f"/intake-forms/{form['id']}/fields/reorder",
        json={"field_ids": [field_b["id"], field_a["id"]]},
        headers=auth_headers(admin),
    )
    assert reorder_res.status_code == 200
    ordered_labels = [f["label"] for f in reorder_res.json()["fields"]]
    assert ordered_labels == ["Field B", "Field A (renamed)"]


def test_publish_unpublish_and_delete_field(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    form = _create_form(client, admin).json()
    field = client.post(
        f"/intake-forms/{form['id']}/fields",
        json={"label": "Field A", "field_type": "text"},
        headers=auth_headers(admin),
    ).json()

    publish_res = client.post(f"/intake-forms/{form['id']}/publish", headers=auth_headers(admin))
    assert publish_res.status_code == 200
    assert publish_res.json()["is_published"] is True

    delete_res = client.delete(f"/intake-forms/{form['id']}/fields/{field['id']}", headers=auth_headers(admin))
    assert delete_res.status_code == 204

    get_res = client.get(f"/intake-forms/{form['id']}", headers=auth_headers(admin))
    assert get_res.json()["fields"] == []


def test_delete_form(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    form = _create_form(client, admin).json()

    delete_res = client.delete(f"/intake-forms/{form['id']}", headers=auth_headers(admin))
    assert delete_res.status_code == 204

    get_res = client.get(f"/intake-forms/{form['id']}", headers=auth_headers(admin))
    assert get_res.status_code == 404


def test_system_form_cannot_be_edited_or_deleted(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    seed_system_support_form(db_session, org.id)
    db_session.commit()

    forms = client.get("/intake-forms", headers=auth_headers(admin)).json()
    system_form = next(f for f in forms if f["is_system"])

    update_res = client.patch(
        f"/intake-forms/{system_form['id']}", json={"title": "Hacked"}, headers=auth_headers(admin)
    )
    assert update_res.status_code == 403

    delete_res = client.delete(f"/intake-forms/{system_form['id']}", headers=auth_headers(admin))
    assert delete_res.status_code == 403

    field_res = client.post(
        f"/intake-forms/{system_form['id']}/fields",
        json={"label": "Sneaky field", "field_type": "text"},
        headers=auth_headers(admin),
    )
    assert field_res.status_code == 403


def test_reorder_rejects_mismatched_field_set(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    form = _create_form(client, admin).json()
    client.post(
        f"/intake-forms/{form['id']}/fields",
        json={"label": "Field A", "field_type": "text"},
        headers=auth_headers(admin),
    )

    res = client.patch(
        f"/intake-forms/{form['id']}/fields/reorder",
        json={"field_ids": ["00000000-0000-0000-0000-000000000000"]},
        headers=auth_headers(admin),
    )
    assert res.status_code == 404


def test_any_staff_can_submit_and_builder_can_convert(client, db_session):
    from app.modules.auth.models.role import UserRole

    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    receptionist, _ = make_staff(db_session, org, role=UserRole.RECEPTIONIST)
    seed_system_support_form(db_session, org.id)
    db_session.commit()

    forms = client.get("/intake-forms", headers=auth_headers(receptionist)).json()
    system_form = next(f for f in forms if f["is_system"])
    request_type_field = next(f for f in system_form["fields"] if f["key"] == "request_type")
    description_field = next(f for f in system_form["fields"] if f["key"] == "description")

    submit_res = client.post(
        f"/intake-forms/{system_form['id']}/submit",
        data={
            "answers_json": (
                f'{{"{request_type_field["id"]}": "New Contract", '
                f'"{description_field["id"]}": "Need a new supplier NDA"}}'
            )
        },
        headers=auth_headers(receptionist),
    )
    assert submit_res.status_code == 201
    submission = submit_res.json()
    assert submission["status"] == "submitted"

    mine_res = client.get("/intake-submissions/mine", headers=auth_headers(receptionist))
    assert mine_res.status_code == 200
    assert len(mine_res.json()) == 1

    convert_res = client.post(
        f"/intake-submissions/{submission['id']}/convert",
        json={"contract_title": "New Supplier NDA"},
        headers=auth_headers(admin),
    )
    assert convert_res.status_code == 200
    assert convert_res.json()["status"] == "converted"
    assert convert_res.json()["converted_contract_id"] is not None


def test_receptionist_cannot_build_forms(client, db_session):
    from app.modules.auth.models.role import UserRole

    org = make_org(db_session)
    receptionist, _ = make_staff(db_session, org, role=UserRole.RECEPTIONIST)

    res = client.post(
        "/intake-forms",
        json={"title": "Should not work", "description": None},
        headers=auth_headers(receptionist),
    )
    assert res.status_code == 403
