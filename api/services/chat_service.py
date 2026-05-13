from __future__ import annotations

import logging

from fastapi import HTTPException

from api.schemas import ChatResponse
from api.services.tool_execution import (
    ToolTracker,
    anthropic_key_configured,
    build_agent_graph,
    extract_final_answer,
    gemini_key_configured,
    groq_key_configured,
    openai_key_configured,
    provider_chain,
)

logger = logging.getLogger("private-credit-api")
_agent_graphs: dict[str, object] = {}
_PROVIDER_LABELS = {
    "anthropic": "Anthropic",
    "openai": "OpenAI",
    "gemini": "Gemini",
    "groq": "Groq",
}


def _get_agent_graph(provider: str):
    if provider not in _agent_graphs:
        _agent_graphs[provider] = build_agent_graph(provider)
    return _agent_graphs[provider]


def _classify_llm_error(exc: Exception) -> tuple[int, str]:
    """Classify provider errors into stable status and reason."""
    message = str(exc)
    lower = message.lower()

    if (
        "credit balance is too low" in lower
        or "plans & billing" in lower
        or "insufficient_quota" in lower
        or "quota" in lower and "insufficient" in lower
    ):
        return 402, "insufficient_credits"
    if (
        "authentication_error" in lower
        or "invalid authentication credentials" in lower
        or "invalid api key" in lower
        or "error code: 401" in lower
        or "unauthorized" in lower
    ):
        return 401, "authentication_failed"
    if "not_found_error" in lower or ("model" in lower and "not found" in lower):
        return 400, "model_unavailable"
    if "rate limit" in lower or "too many requests" in lower or "error code: 429" in lower:
        return 429, "rate_limited"
    if "timeout" in lower or "connection" in lower or "temporarily unavailable" in lower:
        return 503, "provider_unavailable"
    return 502, "provider_error"


def _provider_name(provider: str) -> str:
    return _PROVIDER_LABELS.get(provider, provider)


def _next_available_provider(
    providers: list[str],
    available: dict[str, bool],
    idx: int,
) -> str | None:
    for nxt in providers[idx + 1 :]:
        if available.get(nxt, False):
            return nxt
    return None


def _map_all_failed_error(failures: list[dict[str, str | int]]) -> HTTPException:
    """Build user-safe response after all providers fail."""
    priority = [401, 402, 400, 429, 503, 502]
    selected_status = 502
    for status in priority:
        if any(int(f["status"]) == status for f in failures):
            selected_status = status
            break
    return HTTPException(
        status_code=selected_status,
        detail=(
            "All configured LLM providers failed. "
            "Please verify API keys, model names, provider credits, and retry."
        ),
    )


async def run_chat(prompt: str) -> ChatResponse:
    available = {
        "anthropic": anthropic_key_configured(),
        "openai": openai_key_configured(),
        "gemini": gemini_key_configured(),
        "groq": groq_key_configured(),
    }
    if not any(available.values()):
        raise HTTPException(
            status_code=503,
            detail=(
                "No LLM API key is configured. Set at least one of: "
                "ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY (or Gemin_API_Key), GROQ_API_KEY."
            ),
        )

    tracker = ToolTracker()
    providers = provider_chain()
    failures: list[dict[str, str | int]] = []
    for idx, provider in enumerate(providers):
        if not available.get(provider, False):
            logger.warning("Skipping %s (API key not configured)", _provider_name(provider))
            continue
        logger.warning("Testing %s...", _provider_name(provider))
        try:
            result = await _get_agent_graph(provider).ainvoke(
                {"messages": [{"role": "user", "content": prompt}]},
                config={"callbacks": [tracker]},
            )
            answer = extract_final_answer(result if isinstance(result, dict) else {})
            logger.warning("%s success", _provider_name(provider))
            return ChatResponse(answer=answer, tool_calls=tracker.calls)
        except Exception as exc:
            status, reason = _classify_llm_error(exc)
            failures.append({"provider": provider, "status": status, "reason": reason})
            next_provider = _next_available_provider(providers, available, idx)
            if next_provider:
                logger.warning(
                    "%s failed (%s), switching to %s...",
                    _provider_name(provider),
                    reason,
                    _provider_name(next_provider),
                )
            else:
                logger.error("%s failed (%s). No providers left.", _provider_name(provider), reason)
            continue

    if failures:
        logger.error("All providers failed: %s", failures)
        raise _map_all_failed_error(failures)
    raise HTTPException(status_code=503, detail="No configured provider was available.")
