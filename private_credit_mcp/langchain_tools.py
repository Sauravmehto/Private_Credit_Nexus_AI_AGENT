"""LangChain @tool wrappers (delegates to `tool_functions`)."""

from __future__ import annotations

from typing import Any, Literal, Optional

from langchain_core.tools import tool

import private_credit_mcp.tool_functions as tf

ScenarioLiteral = Literal["maturity_extension", "rate_stepup", "covenant_waiver"]


@tool
def get_portfolio_summary(ip_address: Optional[str] = None) -> dict:
    """Returns aggregate portfolio metrics: deal count, total AUM, avg EIR, weighted avg tenor."""
    return tf.get_portfolio_summary(ip_address)


@tool
def get_deal_metrics(deal_id: str, ip_address: Optional[str] = None) -> dict:
    """Returns deal metrics for a given deal_id: IRR, MOIC, covenant status, days to maturity."""
    return tf.get_deal_metrics(deal_id, ip_address)


@tool
def get_deal_cash_flows(
    deal_id: str, months: Optional[int] = None, ip_address: Optional[str] = None
) -> dict:
    """Returns projected vs actual monthly payment history for a deal."""
    return tf.get_deal_cash_flows(deal_id, months, ip_address)


@tool
def get_covenant_alerts(ip_address: Optional[str] = None) -> list:
    """Returns deals at covenant breach risk, severity-ranked."""
    return tf.get_covenant_alerts(ip_address)


@tool
def search_precedent_deals(
    sector: Optional[str] = None,
    deal_size_min: Optional[float] = None,
    deal_size_max: Optional[float] = None,
    ip_address: Optional[str] = None,
) -> dict:
    """Returns statistical ranges for precedent deals by sector and size."""
    return tf.search_precedent_deals(sector, deal_size_min, deal_size_max, ip_address)


@tool
def search_comparable_deals(
    sector: Optional[str] = None,
    deal_size_min: Optional[float] = None,
    deal_size_max: Optional[float] = None,
    tolerance_pct: Optional[float] = None,
    ip_address: Optional[str] = None,
) -> dict:
    """Returns statistical ranges for comparable historical deals."""
    return tf.search_comparable_deals(sector, deal_size_min, deal_size_max, tolerance_pct, ip_address)


@tool
def calculate_irr(
    principal: float,
    rate: float,
    io_months: int,
    amort_months: int,
    orig_fee: float,
    eot_fee: float,
    warrant_fmv: float,
    ip_address: Optional[str] = None,
) -> dict:
    """Calculates EIR and cash flow sensitivity table from deal parameters."""
    return tf.calculate_irr(principal, rate, io_months, amort_months, orig_fee, eot_fee, warrant_fmv, ip_address)


@tool
def get_amort_schedule(deal_id: str, ip_address: Optional[str] = None) -> dict:
    """Returns month-by-month principal and interest amortization schedule for a deal."""
    return tf.get_amort_schedule(deal_id, ip_address)


@tool
def calculate_term_loan_irr(
    principal: float,
    rate: float,
    io_months: int,
    amort_months: int,
    orig_fee: float,
    eot_fee: float,
    warrant_fmv: float,
    ip_address: Optional[str] = None,
) -> dict:
    """Runs term loan IRR solver and returns schedule, MOIC and fee decomposition."""
    return tf.calculate_term_loan_irr(
        principal, rate, io_months, amort_months, orig_fee, eot_fee, warrant_fmv, ip_address
    )


@tool
def calculate_note_irr(
    principal: float,
    annual_coupon_rate: float,
    term_months: int,
    upfront_fee: float,
    exit_fee: float,
    ip_address: Optional[str] = None,
) -> dict:
    """Calculates bullet/note structure IRR from coupon and maturity terms."""
    return tf.calculate_note_irr(principal, annual_coupon_rate, term_months, upfront_fee, exit_fee, ip_address)


@tool
def calculate_warrant_irr(
    coverage: float,
    strike_val: float,
    fd_shares: float,
    scenarios: list[float],
    probabilities: list[float],
    ip_address: Optional[str] = None,
) -> dict:
    """Runs Black-Scholes FMV and returns exit scenarios with payoff and IRR."""
    return tf.calculate_warrant_irr(coverage, strike_val, fd_shares, scenarios, probabilities, ip_address)


@tool
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
) -> dict:
    """Builds 3-scenario probability tree and returns expected IRR."""
    return tf.calculate_conv_note_irr(
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


@tool
def run_restructure_scenario(
    deal_id: str,
    scenario_type: ScenarioLiteral,
    params: Optional[dict[str, float]] = None,
    ip_address: Optional[str] = None,
) -> dict:
    """Runs a restructure scenario on a deal and returns updated IRR. params maps scenario knobs to numbers."""
    return tf.run_restructure_scenario(deal_id, scenario_type, params, ip_address)


@tool
def compare_before_after_irr(
    deal_id: str,
    scenario_type: ScenarioLiteral,
    params: Optional[dict[str, float]] = None,
    ip_address: Optional[str] = None,
) -> dict:
    """Compares base vs restructured IRR and returns basis-point breakdown."""
    return tf.compare_before_after_irr(deal_id, scenario_type, params, ip_address)


@tool
def compare_all_scenarios(deal_id: str, ip_address: Optional[str] = None) -> list:
    """Runs all six restructure pathways and returns scenario comparison table."""
    return tf.compare_all_scenarios(deal_id, ip_address)


@tool
def get_outstanding_at_breach(
    deal_id: str, breach_month: int, ip_address: Optional[str] = None
) -> dict:
    """Computes outstanding balance and accrued interest at breach month."""
    return tf.get_outstanding_at_breach(deal_id, breach_month, ip_address)


@tool
def calculate_dpo_breakeven(
    deal_id: str, settlement_month: int, ip_address: Optional[str] = None
) -> dict:
    """Finds settlement percentage where lender IRR equals original EIR."""
    return tf.calculate_dpo_breakeven(deal_id, settlement_month, ip_address)


@tool
def generate_warrant_irr(
    coverage: float,
    strike_val: float,
    fd_shares: float,
    scenarios: list[float],
    probabilities: list[float],
    ip_address: Optional[str] = None,
) -> dict:
    """Computes Black-Scholes warrant valuation and expected IRR."""
    return tf.generate_warrant_irr(coverage, strike_val, fd_shares, scenarios, probabilities, ip_address)


@tool
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
    """Generates a formatted term sheet from a local template."""
    return tf.generate_term_sheet(
        company_name, principal, rate, io_months, amort_months, orig_fee, eot_fee, warrant_coverage, ip_address
    )


@tool
def create_irr_model(
    instrument_type: Literal["term_loan", "revolver", "convertible"],
    params: Optional[dict[str, Any]] = None,
    ip_address: Optional[str] = None,
) -> dict:
    """Builds a structured JSON Excel-model specification."""
    return tf.create_irr_model(instrument_type, params, ip_address)


@tool
def generate_restructure_memo(deal_id: str, ip_address: Optional[str] = None) -> str:
    """Generates a full credit committee restructure memo with all scenarios."""
    return tf.generate_restructure_memo(deal_id, ip_address)


ALL_LANGCHAIN_TOOLS: list[Any] = [
    get_portfolio_summary,
    get_deal_metrics,
    get_deal_cash_flows,
    get_covenant_alerts,
    search_precedent_deals,
    search_comparable_deals,
    calculate_irr,
    get_amort_schedule,
    calculate_term_loan_irr,
    calculate_note_irr,
    calculate_warrant_irr,
    calculate_conv_note_irr,
    run_restructure_scenario,
    compare_before_after_irr,
    compare_all_scenarios,
    get_outstanding_at_breach,
    calculate_dpo_breakeven,
    generate_warrant_irr,
    generate_term_sheet,
    create_irr_model,
    generate_restructure_memo,
]
