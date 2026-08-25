"""Pure unit tests for app/modules/templates/render.py — no DB, no HTTP."""
from app.modules.templates.render import normalize_key, render_body


def test_normalize_key_lowercases_and_collapses_whitespace():
    assert normalize_key("Client Full Name") == "client_full_name"


def test_normalize_key_strips_punctuation():
    assert normalize_key("Effective Date (mm/dd/yyyy)") == "effective_date_mm_dd_yyyy"


def test_normalize_key_strips_leading_trailing_underscores():
    assert normalize_key("  #Urgent!  ") == "urgent"


def test_render_body_substitutes_matching_placeholder():
    assert render_body("Hello {{name}}.", {"name": "Ada"}) == "Hello Ada."


def test_render_body_html_escapes_substituted_values():
    assert render_body("{{name}}", {"name": "<script>alert(1)</script>"}) == "&lt;script&gt;alert(1)&lt;/script&gt;"


def test_render_body_marks_missing_placeholder():
    assert render_body("Hello {{name}}.", {}) == "Hello [[missing: name]]."


def test_render_body_no_placeholders_is_a_noop():
    assert render_body("Plain paragraph, no markers.", {"unused": "value"}) == "Plain paragraph, no markers."


def test_render_body_multiple_placeholders():
    body = "{{greeting}}, {{name}}! Today is {{today}}."
    values = {"greeting": "Hi", "name": "Bo", "today": "2026-08-25"}
    assert render_body(body, values) == "Hi, Bo! Today is 2026-08-25."
