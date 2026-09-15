"""
Learned Friend AI assistant: staff-facing chat, grounded in the org's
pre-approved fallback clauses. The LLM call itself is stubbed — these tests
cover conversation persistence, grounding, and org isolation, not the model.
"""
import pytest

from tests.conftest import auth_headers, make_org, make_staff


@pytest.fixture(autouse=True)
def _stub_llm(monkeypatch):
    monkeypatch.setattr(
        "app.modules.ai_assistant.service.call_llm",
        lambda system_prompt, history: f"stubbed reply (saw {len(history)} messages)",
    )


def _create_fallback_clause(client, admin):
    return client.post(
        "/fallback-clauses",
        json={
            "name": "Limitation of Liability (Fallback)",
            "category": "Risk",
            "description": "Pre-approved fallback cap.",
            "content": "Liability shall not exceed 12 months' fees.",
            "pre_approved": True,
        },
        headers=auth_headers(admin),
    )


def test_send_message_creates_conversation(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)

    res = client.post(
        "/ai-assistant/messages",
        json={"content": "What's our liability cap position?"},
        headers=auth_headers(admin),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["title"] == "What's our liability cap position?"
    assert len(body["messages"]) == 2
    assert body["messages"][0]["role"] == "user"
    assert body["messages"][1]["role"] == "assistant"
    assert body["messages"][1]["content"].startswith("stubbed reply")


def test_reply_second_message_reuses_conversation(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)

    first = client.post(
        "/ai-assistant/messages", json={"content": "Hi"}, headers=auth_headers(admin)
    ).json()

    second = client.post(
        "/ai-assistant/messages",
        json={"conversation_id": first["id"], "content": "Follow-up question"},
        headers=auth_headers(admin),
    )
    assert second.status_code == 200
    body = second.json()
    assert body["id"] == first["id"]
    assert len(body["messages"]) == 4


def test_list_and_get_conversation(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)

    created = client.post(
        "/ai-assistant/messages", json={"content": "Hi"}, headers=auth_headers(admin)
    ).json()

    list_res = client.get("/ai-assistant/conversations", headers=auth_headers(admin))
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1

    get_res = client.get(f"/ai-assistant/conversations/{created['id']}", headers=auth_headers(admin))
    assert get_res.status_code == 200
    assert len(get_res.json()["messages"]) == 2


def test_cannot_access_another_users_conversation(client, db_session):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    from app.modules.auth.models.role import UserRole

    lawyer, _ = make_staff(db_session, org, role=UserRole.LAWYER)

    created = client.post(
        "/ai-assistant/messages", json={"content": "Hi"}, headers=auth_headers(admin)
    ).json()

    res = client.get(f"/ai-assistant/conversations/{created['id']}", headers=auth_headers(lawyer))
    assert res.status_code == 404


def test_system_prompt_grounds_in_org_fallback_clauses(client, db_session, monkeypatch):
    org = make_org(db_session)
    admin, _ = make_staff(db_session, org)
    _create_fallback_clause(client, admin)

    captured = {}

    def _capture(system_prompt, history):
        captured["system_prompt"] = system_prompt
        return "reply"

    monkeypatch.setattr("app.modules.ai_assistant.service.call_llm", _capture)

    client.post(
        "/ai-assistant/messages", json={"content": "What's the liability position?"}, headers=auth_headers(admin)
    )

    assert "Limitation of Liability (Fallback)" in captured["system_prompt"]
    assert "12 months' fees" in captured["system_prompt"]
