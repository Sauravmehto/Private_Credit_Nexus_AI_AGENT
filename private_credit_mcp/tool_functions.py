"""Shared tool implementations for LangChain agents (fee normalization, JSON params)."""

from __future__ import annotations

import json
from typing import Any, Literal, Optional

from private_credit_mcp.fee_utils import normalize_orig_eot_fees
from private_credit_mcp.tools import documents as doc_mod
from private_credit_mcp.tools import irr as irr_mod
from private_credit_mcp.tools import portfolio as port_mod

ScenarioLiteral = Literal["maturity_extension", "rate_stepup", "covenant_waiver"]


def get_portfolio_summary(ip_address: Optional[str] = None) -> dict[str, Any]:
    return port_mod.get_portfolio_summary(ip_address)


def get_deal_metrics(deal_id: str, ip_address: Optional[str] = None) -> dict[str, Any]:
    return port_mod.get_deal_metrics(deal_id, ip_address)


def get_deal_cash_flows(
    deal_id: str, months: Optional[int] = None, ip_address: Optional[str] = None
) -> dict[str, Any]:
    return port_mod.get_deal_cash_flows(deal_id, months, ip_address)


def get_covenant_alerts(ip_address: Optional[str] = None) -> list[dict[str, Any]]:
    return port_mod.get_covenant_alerts(ip_address)


def search_precedent_deals(
    sector: Optional[str] = None,
    deal_size_min: Optional[float] = None,
    deal_size_max: Optional[float] = None,
    ip_address: Optional[str] = None,
) -> dict[str, Any]:
    return port_mod.search_precedent_deals(sector, deal_size_min, deal_size_max, ip_address)


def search_comparable_deals(
    sector: Optional[str] = None,
    deal_size_min: Optional[float] = None,
    deal_size_max: Optional[float] = None,
    tolerance_pct: Optional[float] = None,
    ip_address: Optional[str] = None,
) -> dict[str, Any]:
    return port_mod.search_comparable_deals(sector, deal_size_min, deal_size_max, tolerance_pct, ip_address)


def calculate_irr(
    principal: float,
    rate: float,
    io_months: int,
    amort_months: int,
    orig_fee: float,
    eot_fee: float,
    warrant_fmv: float,
    ip_address: Optional[str] = None,
) -> dict[str, Any]:
    o, e = normalize_orig_eot_fees(principal, orig_fee, eot_fee)
    return irr_mod.calculate_irr(principal, rate, io_months, amort_months, o, e, warrant_fmv, ip_address)


def get_amort_schedule(deal_id: str, ip_address: Optional[str] = None) -> dict[str, Any]:
    return irr_mod.get_amort_schedule(deal_id, ip_address)


def calculate_term_loan_irr(
    principal: float,
    rate: float,
    io_months: int,
    amort_months: int,
    orig_fee: float,
    eot_fee: float,
    warrant_fmv: float,
    ip_address: Optional[str] = None,
) -> dict[str, Any]:
    o, e = normalize_orig_eot_fees(principal, orig_fee, eot_fee)
    return irr_mod.calculate_term_loan_irr(principal, rate, io_months, amort_months, o, e, warrant_fmv, ip_address)


def calculate_note_irr(
    principal: float,
    annual_coupon_rate: float,
    term_months: int,
    upfront_fee: float,
    exit_fee: float,
    ip_address: Optional[str] = None,
) -> dict[str, Any]:
    return irr_mod.calculate_note_irr(principal, annual_coupon_rate, term_months, upfront_fee, exit_fee, ip_address)


def calculate_warrant_irr(
    coverage: float,
    strike_val: float,
    fd_shares: float,
    scenarios: list[float],
    probabilities: list[float],
    ip_address: Optional[str] = None,
) -> dict[str, Any]:
    return irr_mod.calculate_warrant_irr(coverage, strike_val, fd_shares, scenarios, probabilities, ip_address)


def calculate_conv_note_irr(
    principal: float,
    term_months: int,
    coupon_rate: float,
    up_round_value: float,
    flat_round_value: float,
    down_round_value: float,
    p_up: float,
    p_flat: float,
    p_down: float,
    ip_address: Optional[str] = None,
) -> dict[str, Any]:
    return irr_mod.calculate_conv_note_irr(
        principal,
        term_months,
        coupon_rate,
        up_round_value,
        flat_round_value,
        down_round_value,
        p_up,
        p_flat,
        p_down,
        ip_address,
    )


def run_restructure_scenario(
    deal_id: str,
    scenario_type: ScenarioLiteral,
    params: dict[str, float] | None = None,
    ip_address: Optional[str] = None,
) -> dict[str, Any]:
    pr = {k: float(v) for k, v in (params or {}).items()}
    return irr_mod.run_restructure_scenario(deal_id, scenario_type, pr, ip_address)


def compare_before_after_irr(
    deal_id: str,
    scenario_type: ScenarioLiteral,
    params: dict[str, float] | None = None,
    ip_address: Optional[str] = None,
) -> dict[str, Any]:
    pr = {k: float(v) for k, v in (params or {}).items()}
    return irr_mod.compare_before_after_irr(deal_id, scenario_type, pr, ip_address)


def compare_all_scenarios(deal_id: str, ip_address: Optional[str] = None) -> list[dict[str, Any]]:
    return irr_mod.compare_all_scenarios(deal_id, ip_address)


def get_outstanding_at_breach(
    deal_id: str, breach_month: int, ip_address: Optional[str] = None
) -> dict[str, Any]:
    return irr_mod.get_outstanding_at_breach(deal_id, breach_month, ip_address)


def calculate_dpo_breakeven(
    deal_id: str, settlement_month: int, ip_address: Optional[str] = None
) -> dict[str, Any]:
    return irr_mod.calculate_dpo_breakeven(deal_id, settlement_month, ip_address)


def generate_warrant_irr(
    coverage: float,
    strike_val: float,
    fd_shares: float,
    scenarios: list[float],
    probabilities: list[float],
    ip_address: Optional[str] = None,
) -> dict[str, Any]:
    return irr_mod.generate_warrant_irr(coverage, strike_val, fd_shares, scenarios, probabilities, ip_address)


def generate_term_sheet(
    company_name: str,
    principal: float,
    rate: float,
    io_months: int,
    amort_months: int,
    orig_fee: float,
    eot_fee: float,
    warrant_coverage: float,
    ip_address: Optional[str] = None,
) -> str:
    o, e = normalize_orig_eot_fees(principal, orig_fee, eot_fee)
    return doc_mod.generate_term_sheet(
        company_name, principal, rate, io_months, amort_months, o, e, warrant_coverage, ip_address
    )


def create_irr_model(
    instrument_type: Literal["term_loan", "revolver", "convertible"],
    params: dict[str, Any] | None = None,
    ip_address: Optional[str] = None,
) -> dict[str, Any]:
    return doc_mod.create_irr_model(instrument_type, params or {}, ip_address)


def generate_restructure_memo(deal_id: str, ip_address: Optional[str] = None) -> str:
    return doc_mod.generate_restructure_memo(deal_id, ip_address)


# Optional JSON strings for LLMs that only emit strings
def run_restructure_scenario_from_json(
    deal_id: str,
    scenario_type: ScenarioLiteral,
    params_json: str = "{}",
    ip_address: Optional[str] = None,
) -> dict[str, Any]:
    raw = json.loads(params_json or "{}")
    params = {str(k): float(v) for k, v in raw.items()}
    return run_restructure_scenario(deal_id, scenario_type, params, ip_address)


def compare_before_after_irr_from_json(
    deal_id: str,
    scenario_type: ScenarioLiteral,
    params_json: str = "{}",
    ip_address: Optional[str] = None,
) -> dict[str, Any]:
    raw = json.loads(params_json or "{}")
    params = {str(k): float(v) for k, v in raw.items()}
    return compare_before_after_irr(deal_id, scenario_type, params, ip_address)


def create_irr_model_from_json(
    instrument_type: Literal["term_loan", "revolver", "convertible"],
    params_json: str = "{}",
    ip_address: Optional[str] = None,
) -> dict[str, Any]:
    params = json.loads(params_json or "{}")
    return create_irr_model(instrument_type, params, ip_address)
