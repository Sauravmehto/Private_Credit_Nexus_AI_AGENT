"""JSON sanitization for MCP tool payloads."""

from __future__ import annotations

import json
import math

import private_credit_mcp.tool_functions as tf
from private_credit_mcp.data.db import resolve_db_name
from private_credit_mcp.json_sanitize import sanitize_for_json


def test_sanitize_replaces_non_finite_floats() -> None:
    raw = {"a": 1.0, "b": float("nan"), "c": float("inf"), "d": [-1.0, float("-inf")]}
    out = sanitize_for_json(raw)
    s = json.dumps(out)
    assert "NaN" not in s and "Infinity" not in s
    assert out["b"] is None and out["c"] is None and out["d"][1] is None


def test_resolve_db_name_from_uri_path() -> None:
    uri = "mongodb+srv://user:pass@cluster.example.mongodb.net/production_app?retryWrites=true&w=majority"
    assert resolve_db_name(uri) == "production_app"


def test_calculate_irr_skips_non_positive_rate_in_sensitivity() -> None:
    out = tf.calculate_irr(3_000_000, 0.015, 12, 18, 0.0083, 0.0321, 0.0)
    assert math.isfinite(out["eir"])
    sens = out["sensitivity_table"]
    assert isinstance(sens, dict)
    assert any(v is None for v in sens.values())
