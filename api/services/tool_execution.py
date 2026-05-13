from __future__ import annotations

import json
import os
import time
from typing import Any
from uuid import UUID

from langgraph.prebuilt import create_react_agent
from langchain_anthropic import ChatAnthropic
from langchain_groq import ChatGroq
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.messages import AIMessage

from api.schemas import ToolCallRecord
from private_credit_mcp.langchain_tools import ALL_LANGCHAIN_TOOLS

DEFAULT_MODEL = "claude-sonnet-4-5-20250929"
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"
DEFAULT_GEMINI_MODEL = "gemini-1.5-flash"
DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant"
SYSTEM_PROMPT = (
    "You are a private credit analyst assistant with access to a live portfolio of venture debt deals. "
    "Use the available tools to answer questions about deals, IRR calculations, covenant monitoring, "
    "and restructuring scenarios. Always provide clear, structured answers with relevant numbers. "
    "Format financial figures clearly: percentages as '14.8%', dollar amounts as '$3.0M'. "
    "Use Markdown tables for tabular data; never output raw HTML table code. "
    "When multiple tools are needed, call them in sequence and synthesize the results."
)


def anthropic_model_id() -> str:
    return os.getenv("ANTHROPIC_MODEL") or os.getenv("CLAUDE_MODEL") or DEFAULT_MODEL


def anthropic_key_configured() -> bool:
    return bool(os.getenv("ANTHROPIC_API_KEY", "").strip())


def openai_model_id() -> str:
    return os.getenv("OPENAI_MODEL") or DEFAULT_OPENAI_MODEL


def gemini_model_id() -> str:
    return os.getenv("GEMINI_MODEL") or DEFAULT_GEMINI_MODEL


def groq_model_id() -> str:
    return os.getenv("GROQ_MODEL") or DEFAULT_GROQ_MODEL


def openai_key_configured() -> bool:
    return bool(os.getenv("OPENAI_API_KEY", "").strip())


def gemini_key_configured() -> bool:
    # Accept common variants to match existing .env naming.
    return bool(
        os.getenv("GEMINI_API_KEY", "").strip()
        or os.getenv("Gemin_API_Key", "").strip()
        or os.getenv("GOOGLE_API_KEY", "").strip()
    )


def groq_key_configured() -> bool:
    return bool(os.getenv("GROQ_API_KEY", "").strip())


def provider_chain() -> list[str]:
    return ["anthropic", "openai", "gemini", "groq"]


class ToolTracker(BaseCallbackHandler):
    """Captures tool invocations with timing per request."""

    def __init__(self) -> None:
        self.calls: list[ToolCallRecord] = []
        self._pending: dict[str, dict[str, Any]] = {}

    def on_tool_start(
        self,
        serialized: dict[str, Any],
        input_str: str,
        *,
        run_id: UUID,
        **kwargs: Any,
    ) -> None:
        name = serialized.get("name", "unknown")
        try:
            inp: dict[str, Any] = json.loads(input_str)
        except (json.JSONDecodeError, TypeError):
            inp = {"raw": str(input_str)}
        self._pending[str(run_id)] = {
            "tool": name,
            "input": inp,
            "start": time.monotonic(),
        }

    def on_tool_end(self, output: Any, *, run_id: UUID, **kwargs: Any) -> None:
        self._flush(str(run_id), output, error=False)

    def on_tool_error(self, error: Any, *, run_id: UUID, **kwargs: Any) -> None:
        self._flush(str(run_id), {"error": str(error)}, error=True)

    def _flush(self, key: str, raw_output: Any, *, error: bool) -> None:
        if key not in self._pending:
            return
        pending = self._pending.pop(key)
        elapsed = int((time.monotonic() - pending["start"]) * 1000)
        if not error:
            try:
                out = json.loads(raw_output) if isinstance(raw_output, str) else raw_output
            except (json.JSONDecodeError, TypeError):
                out = raw_output
        else:
            out = raw_output
        self.calls.append(
            ToolCallRecord(
                tool=pending["tool"],
                input=pending["input"],
                output=out,
                duration_ms=elapsed,
            )
        )


def extract_final_answer(result: dict[str, Any]) -> str:
    messages = result.get("messages") or []
    for m in reversed(messages):
        if isinstance(m, AIMessage):
            content = m.content
            if isinstance(content, str):
                return content
            if isinstance(content, list):
                parts: list[str] = []
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "text":
                        parts.append(str(block.get("text", "")))
                    elif isinstance(block, str):
                        parts.append(block)
                return "".join(parts)
    return ""


def _build_model(provider: str) -> Any:
    if provider == "anthropic":
        return ChatAnthropic(model=anthropic_model_id(), temperature=0)
    if provider == "openai":
        return ChatOpenAI(model=openai_model_id(), temperature=0)
    if provider == "gemini":
        # ChatGoogleGenerativeAI reads GOOGLE_API_KEY by default.
        # Mirror Gemin_API_Key/GEMINI_API_KEY into GOOGLE_API_KEY for compatibility.
        if not os.getenv("GOOGLE_API_KEY", "").strip():
            gemini_key = os.getenv("GEMINI_API_KEY", "").strip() or os.getenv("Gemin_API_Key", "").strip()
            if gemini_key:
                os.environ["GOOGLE_API_KEY"] = gemini_key
        return ChatGoogleGenerativeAI(model=gemini_model_id(), temperature=0)
    if provider == "groq":
        return ChatGroq(model=groq_model_id(), temperature=0)
    raise ValueError(f"Unsupported provider: {provider}")


def build_agent_graph(provider: str) -> Any:
    llm = _build_model(provider)
    return create_react_agent(
        model=llm,
        tools=ALL_LANGCHAIN_TOOLS,
        prompt=SYSTEM_PROMPT,
    )
