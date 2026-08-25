"""
Document generation from a template body + intake submission answers
(MatterService.generate_document_from_template). Stubs R2/malware-scan the same way
test_matters.py's _stub_r2_and_scanner does — xhtml2pdf itself is left to run for real
(pure Python, no native deps, fast enough) so these are genuine end-to-end checks.
"""
import pytest

from app.modules.intake.models import (
    IntakeForm,
    IntakeFormField,
    IntakeFieldType,
    IntakeSubmission,
    IntakeSubmissionAnswer,
    IntakeSubmissionStatus,
)
from app.modules.templates.models import Template
from tests.conftest import auth_headers, make_client_company, make_contact, make_firm, make_matter, make_staff


@pytest.fixture(autouse=True)
def _stub_r2_and_scanner(monkeypatch):
    monkeypatch.setattr("app.modules.matters.service.upload_file", lambda *a, **k: "matter_documents/fake-key")
    monkeypatch.setattr("app.modules.matters.service.scan_file", lambda *a, **k: None)


def make_template(db_session, firm, **overrides):
    template = Template(
        firm_id=firm.id,
        title=overrides.get("title", "Test Template"),
        description=overrides.get("description"),
        category=overrides.get("category", "General"),
        file_key=overrides.get("file_key", "templates/fake-key"),
        original_filename=overrides.get("original_filename", "template.pdf"),
        content_type=overrides.get("content_type", "application/pdf"),
        body=overrides.get("body"),
    )
    db_session.add(template)
    db_session.flush()
    return template


def make_intake_form(db_session, firm, **overrides):
    form = IntakeForm(firm_id=firm.id, title=overrides.get("title", "Test Form"), is_published=True)
    db_session.add(form)
    db_session.flush()
    return form


def make_intake_field(db_session, form, **overrides):
    field = IntakeFormField(
        form_id=form.id,
        label=overrides.get("label", "Test Field"),
        field_type=overrides.get("field_type", IntakeFieldType.TEXT),
        is_required=overrides.get("is_required", False),
        display_order=overrides.get("display_order", 0),
    )
    db_session.add(field)
    db_session.flush()
    return field


def make_intake_submission(db_session, firm, form, client_company, contact, **overrides):
    submission = IntakeSubmission(
        firm_id=firm.id,
        form_id=form.id,
        client_id=client_company.id,
        contact_id=contact.id,
        status=overrides.get("status", IntakeSubmissionStatus.SUBMITTED),
    )
    db_session.add(submission)
    db_session.flush()
    return submission


def make_answer(db_session, submission, field, value):
    answer = IntakeSubmissionAnswer(submission_id=submission.id, field_id=field.id, value=value)
    db_session.add(answer)
    db_session.flush()
    return answer


def _generate(client, matter_id, template_id, submission_id, admin, title=None):
    body = {"template_id": str(template_id), "intake_submission_id": str(submission_id)}
    if title:
        body["title"] = title
    return client.post(f"/matters/{matter_id}/documents/generate", json=body, headers=auth_headers(admin))


def test_generate_document_substitutes_answers(client, db_session):
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    client_company = make_client_company(db_session, firm)
    contact, _ = make_contact(db_session, client_company)
    matter = make_matter(db_session, firm, client_company)
    template = make_template(
        db_session, firm, title="NDA", body="Agreement between {{client_name}} and {{counterparty}}."
    )
    form = make_intake_form(db_session, firm)
    field = make_intake_field(db_session, form, label="Counterparty")
    submission = make_intake_submission(db_session, firm, form, client_company, contact)
    make_answer(db_session, submission, field, "Acme Corp")

    res = _generate(client, matter.id, template.id, submission.id, admin)
    assert res.status_code == 201
    body = res.json()
    assert body["content_type"] == "application/pdf"
    assert body["version"] == 1


def test_generate_document_with_unanswered_field_still_succeeds(client, db_session):
    """An unmatched {{placeholder}} renders as [[missing: ...]] rather than erroring —
    confirmed at the render.py unit-test level; here we just confirm the whole request
    still completes and produces a document."""
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    client_company = make_client_company(db_session, firm)
    contact, _ = make_contact(db_session, client_company)
    matter = make_matter(db_session, firm, client_company)
    template = make_template(db_session, firm, body="See {{nonexistent_field}}.")
    form = make_intake_form(db_session, firm)
    submission = make_intake_submission(db_session, firm, form, client_company, contact)

    res = _generate(client, matter.id, template.id, submission.id, admin)
    assert res.status_code == 201


def test_generate_document_requires_template_with_body(client, db_session):
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    client_company = make_client_company(db_session, firm)
    contact, _ = make_contact(db_session, client_company)
    matter = make_matter(db_session, firm, client_company)
    template = make_template(db_session, firm, body=None)
    form = make_intake_form(db_session, firm)
    submission = make_intake_submission(db_session, firm, form, client_company, contact)

    res = _generate(client, matter.id, template.id, submission.id, admin)
    assert res.status_code == 409


def test_generate_document_rejects_submission_from_other_client(client, db_session):
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    client_company = make_client_company(db_session, firm)
    other_client_company = make_client_company(db_session, firm)
    contact, _ = make_contact(db_session, other_client_company)
    matter = make_matter(db_session, firm, client_company)
    template = make_template(db_session, firm, body="Hello {{client_name}}.")
    form = make_intake_form(db_session, firm)
    submission = make_intake_submission(db_session, firm, form, other_client_company, contact)

    res = _generate(client, matter.id, template.id, submission.id, admin)
    assert res.status_code == 400


def test_generate_document_twice_bumps_version(client, db_session):
    firm = make_firm(db_session)
    admin, _ = make_staff(db_session, firm)
    client_company = make_client_company(db_session, firm)
    contact, _ = make_contact(db_session, client_company)
    matter = make_matter(db_session, firm, client_company)
    template = make_template(db_session, firm, body="Hello {{client_name}}.")
    form = make_intake_form(db_session, firm)
    submission = make_intake_submission(db_session, firm, form, client_company, contact)

    first = _generate(client, matter.id, template.id, submission.id, admin, title="Draft NDA")
    second = _generate(client, matter.id, template.id, submission.id, admin, title="Draft NDA")
    assert first.json()["version"] == 1
    assert second.json()["version"] == 2
