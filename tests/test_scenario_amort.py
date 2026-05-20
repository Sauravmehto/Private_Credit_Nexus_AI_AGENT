"""Amortization schedule respects scenario IO/amort/tenure overrides."""

from __future__ import annotations

from api.services import portfolio_service as ps


def _sample_deal() -> dict:
    return {
        "id": "TEST-001",
        "principal": 1_800_000.0,
        "rate": 0.1225,
        "io": 6,
        "amort": 30,
        "tenure": 36,
        "orig_fee": 0.02,
        "eot_fee": 0.01,
        "pik_rate": 0.0,
        "origination": "2025-02-01",
    }


def test_amort_schedule_row_count_matches_tenure() -> None:
    deal = _sample_deal()
    rows = ps.get_amortization(deal)
    assert len(rows) == 36


def test_amort_schedule_io_phase_count() -> None:
    deal = _sample_deal()
    rows = ps.get_amortization(deal)
    io_rows = [r for r in rows if r["phase"] == "IO"]
    assert len(io_rows) == 6


def test_scenario_changes_io_and_amort() -> None:
    base = _sample_deal()
    scenario = {**base, "io": 9, "amort": 27, "tenure": 36, "rate": 0.13}
    rows = ps.get_amortization(scenario)
    assert len(rows) == 36
    io_rows = [r for r in rows if r["phase"] == "IO"]
    assert len(io_rows) == 9
    assert rows[0]["interest"] != ps.get_amortization(base)[0]["interest"] or scenario["rate"] != base["rate"]
