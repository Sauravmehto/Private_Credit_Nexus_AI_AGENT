"""Structured logging + Mongo audit sink."""

from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from api.request_context import get_request_id
from private_credit_mcp.data.db import insert_audit_log

LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
logs_dir = Path.cwd() / "logs"
logs_dir.mkdir(parents=True, exist_ok=True)

logger = logging.getLogger("private-credit-mcp")
if not logger.handlers:
    logger.setLevel(LOG_LEVEL)
    ch = logging.StreamHandler()
    ch.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(ch)
    fh = logging.FileHandler(logs_dir / "audit.log", encoding="utf-8")
    fh.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(fh)

_audit_sink: Callable[[dict[str, Any]], None] | None = None


def _default_sink(record: dict[str, Any]) -> None:
    insert_audit_log(dict(record))


_audit_sink = _default_sink


def set_audit_sink_for_tests(sink: Callable[[dict[str, Any]], None] | None) -> None:
    global _audit_sink
    _audit_sink = sink


def audit_log(
    *,
    user_id: str,
    tool: str,
    params: Any,
    response_summary: str,
    ip_address: str,
    timestamp: str | None = None,
) -> None:
    ts = timestamp or datetime.now(timezone.utc).isoformat()
    record = {
        "user_id": user_id,
        "tool": tool,
        "params": json.dumps(params) if not isinstance(params, str) else params,
        "response_summary": response_summary,
        "timestamp": ts,
        "ip_address": ip_address,
        "request_id": get_request_id(),
    }
    logger.info(
        json.dumps(
            {
                "event": "tool_audit_log",
                "user_id": user_id,
                "tool": tool,
                "timestamp": ts,
                "ip_address": ip_address,
                "request_id": record["request_id"],
            }
        )
    )
    try:
        if _audit_sink:
            _audit_sink(record)
    except Exception as e:  # noqa: BLE001
        logger.error("audit_log_db_write_failed tool=%s err=%s", tool, e)

