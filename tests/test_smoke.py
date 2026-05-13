"""Smoke tests: pure-IRR always; full integration when MONGODB_URI is set."""

from __future__ import annotations

import math
import os

import pytest

import private_credit_mcp.tool_functions as tf
from private_credit_mcp.data.db import close_connection


def test_calculate_irr() -> None:
    irr = tf.calculate_irr(5_000_000, 0.14, 6, 36, 50_000, 25_000, 100_000)
    assert math.isfinite(irr["eir"])


def test_calculate_term_loan_irr() -> None:
    tl = tf.calculate_term_loan_irr(5_000_000, 0.14, 6, 36, 50_000, 25_000, 100_000)
    assert len(tl["schedule"]) == 42


def test_calculate_note_irr() -> None:
    n = tf.calculate_note_irr(2_000_000, 0.12, 24, 20_000, 15_000)
    assert math.isfinite(n["eir"])


def test_generate_warrant_and_calc() -> None:
    gen = tf.generate_warrant_irr(0.12, 6_500_000, 88_000_000, [50e6, 90e6, 150e6], [0.25, 0.5, 0.25])
    assert math.isfinite(gen["expected_irr"])
    calc = tf.calculate_warrant_irr(0.12, 6_500_000, 88_000_000, [50e6, 90e6, 150e6], [0.25, 0.5, 0.25])
    assert len(calc["scenarios"]) == 3


def test_conv_note() -> None:
    c = tf.calculate_conv_note_irr(
        2_000_000,
        24,
        0.1,
        3_000_000,
        2_300_000,
        1_700_000,
        0.3,
        0.4,
        0.3,
    )
    assert math.isfinite(c["expected_irr"])


def test_term_sheet_and_irr_model() -> None:
    ts = tf.generate_term_sheet("Acme", 3_000_000, 0.1215, 12, 18, 24_900, 96_300, 0.0)
    assert len(ts) > 20
    model = tf.create_irr_model("term_loan", {"principal": 5_000_000, "rate": 0.14})
    assert isinstance(model.get("sheets"), list)


def test_langchain_tools_import() -> None:
    from private_credit_mcp.langchain_tools import ALL_LANGCHAIN_TOOLS

    assert len(ALL_LANGCHAIN_TOOLS) == 21


def test_fastapi_app_loads() -> None:
    from api.main import app

    assert app.title == "Private Credit Chat API"


@pytest.mark.integration
def test_all_tools_with_mongo() -> None:
    if not os.environ.get("MONGODB_URI"):
        pytest.skip("MONGODB_URI not set — seed the DB and re-run for full parity smoke.")

    deal_id = "VD-2023-0101"
    ran = set()

    summary = tf.get_portfolio_summary()
    ran.add("get_portfolio_summary")
    assert summary["deal_count"] >= 1

    metrics = tf.get_deal_metrics(deal_id)
    ran.add("get_deal_metrics")
    assert isinstance(metrics["company_name"], str)

    alerts = tf.get_covenant_alerts()
    ran.add("get_covenant_alerts")
    assert isinstance(alerts, list)

    precedents = tf.search_precedent_deals("Fintech", 1_000_000, 15_000_000)
    ran.add("search_precedent_deals")
    assert precedents["deal_count"] >= 0

    cash = tf.get_deal_cash_flows(deal_id, 12)
    ran.add("get_deal_cash_flows")
    assert len(cash["monthly_cash_flows"]) == 12

    comparable = tf.search_comparable_deals("Fintech", 1_000_000, 15_000_000)
    ran.add("search_comparable_deals")
    assert comparable["comparable_count"] >= 0

    irr = tf.calculate_irr(5_000_000, 0.14, 6, 36, 50_000, 25_000, 100_000)
    ran.add("calculate_irr")
    assert math.isfinite(irr["eir"])

    tl = tf.calculate_term_loan_irr(5_000_000, 0.14, 6, 36, 50_000, 25_000, 100_000)
    ran.add("calculate_term_loan_irr")
    assert len(tl["schedule"]) == 42

    amort = tf.get_amort_schedule(deal_id)
    ran.add("get_amort_schedule")
    assert len(amort["schedule"]) > 0

    note = tf.calculate_note_irr(2_000_000, 0.12, 24, 20_000, 15_000)
    ran.add("calculate_note_irr")
    assert math.isfinite(note["eir"])

    tf.generate_warrant_irr(0.12, 6_500_000, 88_000_000, [50e6, 90e6, 150e6], [0.25, 0.5, 0.25])
    ran.add("generate_warrant_irr")

    cw = tf.calculate_warrant_irr(0.12, 6_500_000, 88_000_000, [50e6, 90e6, 150e6], [0.25, 0.5, 0.25])
    ran.add("calculate_warrant_irr")
    assert len(cw["scenarios"]) == 3

    tf.calculate_conv_note_irr(2_000_000, 24, 0.1, 3e6, 2.3e6, 1.7e6, 0.3, 0.4, 0.3)
    ran.add("calculate_conv_note_irr")

    rs = tf.run_restructure_scenario(deal_id, "rate_stepup", {"rateStep": 0.02})
    ran.add("run_restructure_scenario")
    assert len(rs["revised_schedule"]) > 0

    ba = tf.compare_before_after_irr(deal_id, "maturity_extension", {"extraMonths": 6})
    ran.add("compare_before_after_irr")
    assert math.isfinite(ba["delta_bps"])

    all_s = tf.compare_all_scenarios(deal_id)
    ran.add("compare_all_scenarios")
    assert len(all_s) == 6

    ob = tf.get_outstanding_at_breach(deal_id, 6)
    ran.add("get_outstanding_at_breach")
    assert ob["outstanding_balance"] >= 0

    dpo = tf.calculate_dpo_breakeven(deal_id, 12)
    ran.add("calculate_dpo_breakeven")
    assert dpo["breakeven_dpo_pct"] >= 0

    ts = tf.generate_term_sheet("Axon Therapeutics", 3_000_000, 0.1215, 12, 18, 24_900, 96_300, 0)
    ran.add("generate_term_sheet")
    assert len(ts) > 20

    tf.create_irr_model("term_loan", {"principal": 5_000_000, "rate": 0.14})
    ran.add("create_irr_model")

    memo = tf.generate_restructure_memo(deal_id)
    ran.add("generate_restructure_memo")
    assert "Credit Committee Restructure Memo" in memo

    expected = {
        "calculate_conv_note_irr",
        "calculate_dpo_breakeven",
        "calculate_irr",
        "calculate_note_irr",
        "calculate_term_loan_irr",
        "calculate_warrant_irr",
        "compare_all_scenarios",
        "compare_before_after_irr",
        "create_irr_model",
        "generate_restructure_memo",
        "generate_term_sheet",
        "generate_warrant_irr",
        "get_amort_schedule",
        "get_covenant_alerts",
        "get_deal_cash_flows",
        "get_deal_metrics",
        "get_outstanding_at_breach",
        "get_portfolio_summary",
        "run_restructure_scenario",
        "search_comparable_deals",
        "search_precedent_deals",
    }
    assert ran == expected

    close_connection()
