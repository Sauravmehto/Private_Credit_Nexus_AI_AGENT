"""FastAPI chat API smoke tests."""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client() -> TestClient:
    from api.main import app

    return TestClient(app)


def test_health(client: TestClient) -> None:
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "ok"
    assert "private-credit-chat-api" in data.get("service", "")


def test_chat_without_api_key_returns_503(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("ANTHROPIC_API_KEY", "")
    monkeypatch.setenv("OPENAI_API_KEY", "")
    monkeypatch.setenv("GEMINI_API_KEY", "")
    monkeypatch.setenv("Gemin_API_Key", "")
    monkeypatch.setenv("GROQ_API_KEY", "")
    r = client.post("/chat", json={"prompt": "hello"})
    assert r.status_code == 503
    body = r.json()
    assert body["error"]["code"] == "service_unavailable"
    assert "No LLM API key is configured" in body["error"]["message"]
    assert body["error"]["request_id"]
    assert r.headers.get("x-request-id")


def test_upload_rejects_invalid_extension_with_normalized_error(client: TestClient) -> None:
    r = client.post(
        "/upload",
        files={"file": ("portfolio.txt", b"not,a,csv", "text/plain")},
    )
    assert r.status_code == 422
    body = r.json()
    assert body["error"]["code"] == "validation_error"
    assert "Unsupported file type" in body["error"]["message"]


def test_request_id_is_preserved_from_header(client: TestClient) -> None:
    r = client.get("/health", headers={"x-request-id": "req-123"})
    assert r.status_code == 200
    assert r.headers.get("x-request-id") == "req-123"


class _FakeGraph:
    def __init__(self, provider: str, outcomes: dict[str, object]):
        self.provider = provider
        self.outcomes = outcomes

    async def ainvoke(self, *_args, **_kwargs):
        outcome = self.outcomes[self.provider]
        if isinstance(outcome, Exception):
            raise outcome
        return {"messages": [outcome]}


def _patch_provider_fallback(
    monkeypatch: pytest.MonkeyPatch,
    outcomes: dict[str, object],
    *,
    configured: dict[str, bool] | None = None,
) -> None:
    from api.services import chat_service
    from langchain_core.messages import AIMessage

    flags = configured or {k: True for k in outcomes.keys()}
    monkeypatch.setattr(chat_service, "anthropic_key_configured", lambda: flags.get("anthropic", False))
    monkeypatch.setattr(chat_service, "openai_key_configured", lambda: flags.get("openai", False))
    monkeypatch.setattr(chat_service, "gemini_key_configured", lambda: flags.get("gemini", False))
    monkeypatch.setattr(chat_service, "groq_key_configured", lambda: flags.get("groq", False))
    monkeypatch.setattr(chat_service, "provider_chain", lambda: ["anthropic", "openai", "gemini", "groq"])

    def _fake_get(provider: str):
        value = outcomes[provider]
        if isinstance(value, str):
            value = AIMessage(content=value)
            outcomes[provider] = value
        return _FakeGraph(provider, outcomes)

    monkeypatch.setattr(chat_service, "_get_agent_graph", _fake_get)


def test_chat_falls_back_anthropic_to_openai_success(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level("INFO", logger="private-credit-api")
    _patch_provider_fallback(
        monkeypatch,
        {
            "anthropic": Exception("Error code: 402 credit balance is too low"),
            "openai": "openai-ok",
            "gemini": "unused",
            "groq": "unused",
        },
    )
    r = client.post("/chat", json={"prompt": "hello"})
    assert r.status_code == 200, r.text
    assert r.json()["answer"] == "openai-ok"
    logs = caplog.text
    assert "Testing Anthropic..." in logs
    assert "Anthropic failed (insufficient_credits), switching to OpenAI..." in logs
    assert "OpenAI success" in logs


def test_chat_falls_back_to_gemini_after_two_failures(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level("INFO", logger="private-credit-api")
    _patch_provider_fallback(
        monkeypatch,
        {
            "anthropic": Exception("Error code: 401 invalid authentication credentials"),
            "openai": Exception("Rate limit exceeded"),
            "gemini": "gemini-ok",
            "groq": "unused",
        },
    )
    r = client.post("/chat", json={"prompt": "hello"})
    assert r.status_code == 200, r.text
    assert r.json()["answer"] == "gemini-ok"
    logs = caplog.text
    assert "Anthropic failed (authentication_failed), switching to OpenAI..." in logs
    assert "OpenAI failed (rate_limited), switching to Gemini..." in logs
    assert "Gemini success" in logs


def test_chat_falls_back_to_groq_after_three_failures(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level("INFO", logger="private-credit-api")
    _patch_provider_fallback(
        monkeypatch,
        {
            "anthropic": Exception("credit balance is too low"),
            "openai": Exception("invalid api key"),
            "gemini": Exception("model not found"),
            "groq": "groq-ok",
        },
    )
    r = client.post("/chat", json={"prompt": "hello"})
    assert r.status_code == 200, r.text
    assert r.json()["answer"] == "groq-ok"
    logs = caplog.text
    assert "Anthropic failed (insufficient_credits), switching to OpenAI..." in logs
    assert "OpenAI failed (authentication_failed), switching to Gemini..." in logs
    assert "Gemini failed (model_unavailable), switching to Groq..." in logs
    assert "Groq success" in logs


def test_chat_all_providers_fail_returns_normalized_error_without_raw_message(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level("INFO", logger="private-credit-api")
    _patch_provider_fallback(
        monkeypatch,
        {
            "anthropic": Exception("Error code: 402 credit balance is too low"),
            "openai": Exception("invalid api key"),
            "gemini": Exception("model not found"),
            "groq": Exception("temporary network timeout"),
        },
    )
    r = client.post("/chat", json={"prompt": "hello"})
    assert r.status_code == 401
    body = r.json()
    msg = body["error"]["message"].lower()
    assert "all configured llm providers failed" in msg
    assert "credit balance is too low" not in msg
    assert "invalid api key" not in msg
    assert "model not found" not in msg
    assert "All providers failed" in caplog.text


@pytest.mark.integration
def test_chat_with_api_key_short_prompt(client: TestClient) -> None:
    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not key:
        pytest.skip("ANTHROPIC_API_KEY not set — skips live Anthropic call.")
    r = client.post("/chat", json={"prompt": "Reply with exactly the word: pong"})
    if r.status_code >= 500 and "Could not resolve authentication method" in r.text:
        pytest.skip("Anthropic credentials are present but invalid in the local environment.")
    if r.status_code == 500 and (
        "authentication_error" in r.text or "Invalid authentication credentials" in r.text or "401" in r.text
    ):
        pytest.skip("ANTHROPIC_API_KEY is set but rejected by the API (invalid or expired).")
    if r.status_code == 402 and ("insufficient credits" in r.text.lower() or "billing" in r.text.lower()):
        pytest.skip("Anthropic account has insufficient credits for live integration call.")
    assert r.status_code == 200, r.text
    body = r.json()
    assert "answer" in body
    assert isinstance(body.get("tool_calls"), list)
