"""IRR and restructuring math (schedules, warrants, conv note, scenarios)."""

from __future__ import annotations

import json
import math
from typing import Any, Literal, TypedDict

from private_credit_mcp.audit.logger import audit_log
from private_credit_mcp.data.db import find_deal_by_id
from private_credit_mcp.json_sanitize import sanitize_for_json


def json_dumps_slice(obj: Any, limit: int = 400) -> str:
    s = json.dumps(obj, default=str)
    return s[:limit]


def summarize(payload: Any) -> str:
    return json_dumps_slice(payload)


def calculate_irr_value(cash_flows: list[float], guess: float = 0.1) -> float:
    max_iterations = 100
    tolerance = 1e-7
    rate = guess
    for _ in range(max_iterations):
        npv = 0.0
        derivative = 0.0
        for t, cf in enumerate(cash_flows):
            discount = (1 + rate) ** t
            npv += cf / discount
            if t > 0:
                derivative -= (t * cf) / ((1 + rate) ** (t + 1))
        if abs(npv) < tolerance:
            return rate
        if derivative == 0:
            break
        rate -= npv / derivative
    raise RuntimeError("IRR failed to converge")


def npv(cash_flows: list[float], rate: float) -> float:
    return sum(cf / ((1 + rate) ** t) for t, cf in enumerate(cash_flows))


def sign(x: float) -> int:
    if x > 0:
        return 1
    if x < 0:
        return -1
    return 0


def solve_irr_bisection(
    cash_flows: list[float],
    lower: float = -0.95,
    upper: float = 5.0,
    tolerance: float = 1e-8,
    max_iter: int = 400,
) -> float:
    lo = lower
    hi = upper
    f_lo = npv(cash_flows, lo)
    f_hi = npv(cash_flows, hi)

    if sign(f_lo) == sign(f_hi):
        for _ in range(30):
            hi *= 1.5
            f_hi = npv(cash_flows, hi)
            if sign(f_lo) != sign(f_hi):
                break

    if sign(f_lo) == sign(f_hi):
        return calculate_irr_value(cash_flows, 0.1)

    for _ in range(max_iter):
        mid = (lo + hi) / 2
        f_mid = npv(cash_flows, mid)
        if abs(f_mid) < tolerance:
            return mid
        if sign(f_mid) == sign(f_lo):
            lo = mid
            f_lo = f_mid
        else:
            hi = mid
            f_hi = f_mid
    return (lo + hi) / 2


class LoanParams(TypedDict):
    principal: float
    rate: float
    io_months: int
    amort_months: int
    orig_fee: float
    eot_fee: float
    warrant_fmv: float


def build_cash_flows(params: LoanParams) -> list[float]:
    flows: list[float] = []
    funded_principal = params["principal"] - params["orig_fee"]
    flows.append(-funded_principal)

    monthly_rate = params["rate"] / 12
    io_payment = params["principal"] * monthly_rate
    for _ in range(params["io_months"]):
        flows.append(io_payment)

    remaining = params["principal"]
    principal_step = remaining / max(params["amort_months"], 1)
    for i in range(1, params["amort_months"] + 1):
        balance_before = remaining - principal_step * (i - 1)
        interest = balance_before * monthly_rate
        principal_payment = remaining - principal_step * (i - 1) if i == params["amort_months"] else principal_step
        flows.append(interest + principal_payment)

    flows[-1] += params["eot_fee"] + params["warrant_fmv"]
    return flows


class ScheduleRow(TypedDict):
    month: int
    opening_balance: float
    interest: float
    principal: float
    total_payment: float
    closing_balance: float


def build_schedule(params: LoanParams) -> list[ScheduleRow]:
    rows: list[ScheduleRow] = []
    monthly_rate = params["rate"] / 12
    balance = params["principal"]
    amort_step = params["principal"] / params["amort_months"] if params["amort_months"] > 0 else params["principal"]
    total_months = params["io_months"] + params["amort_months"]
    for m in range(1, total_months + 1):
        opening = balance
        interest = opening * monthly_rate
        principal_pay = 0.0 if m <= params["io_months"] else min(balance, amort_step)
        total = interest + principal_pay
        balance = max(0.0, opening - principal_pay)
        if m == total_months:
            total += params["eot_fee"] + params["warrant_fmv"]
        rows.append(
            {
                "month": m,
                "opening_balance": round(opening, 2),
                "interest": round(interest, 2),
                "principal": round(principal_pay, 2),
                "total_payment": round(total, 2),
                "closing_balance": round(balance, 2),
            }
        )
    return rows


def _audit(tool: str, params: dict[str, Any], summary: str, ip: str | None) -> None:
    audit_log(
        user_id="anonymous",
        tool=tool,
        params=params,
        response_summary=summary,
        ip_address=ip or "unknown",
    )


def calculate_irr(
    principal: float,
    rate: float,
    io_months: int,
    amort_months: int,
    orig_fee: float,
    eot_fee: float,
    warrant_fmv: float,
    ip_address: str | None = None,
) -> dict[str, Any]:
    inp: LoanParams = {
        "principal": principal,
        "rate": rate,
        "io_months": io_months,
        "amort_months": amort_months,
        "orig_fee": orig_fee,
        "eot_fee": eot_fee,
        "warrant_fmv": warrant_fmv,
    }
    cash_flows = build_cash_flows(inp)
    monthly_irr = solve_irr_bisection(cash_flows)
    eir = (1 + monthly_irr) ** 12 - 1
    sensitivity: dict[str, float | None] = {}
    min_coupon_rate = 1e-12
    for bump in (-0.02, -0.01, 0, 0.01, 0.02):
        adj = rate + bump
        key = f"{adj:.4f}"
        if adj <= min_coupon_rate:
            sensitivity[key] = None
            continue
        scenario = {**inp, "rate": adj}
        scenario_irr = solve_irr_bisection(build_cash_flows(scenario))
        sensitivity[key] = (1 + scenario_irr) ** 12 - 1

    payload = sanitize_for_json(
        {"eir": eir, "cash_flow_schedule": cash_flows, "sensitivity_table": sensitivity}
    )
    args = {
        "principal": principal,
        "rate": rate,
        "io_months": io_months,
        "amort_months": amort_months,
        "orig_fee": orig_fee,
        "eot_fee": eot_fee,
        "warrant_fmv": warrant_fmv,
        "ip_address": ip_address,
    }
    _audit("calculate_irr", args, summarize(payload), ip_address)
    return payload


def calculate_term_loan_irr(
    principal: float,
    rate: float,
    io_months: int,
    amort_months: int,
    orig_fee: float,
    eot_fee: float,
    warrant_fmv: float,
    ip_address: str | None = None,
) -> dict[str, Any]:
    inp: LoanParams = {
        "principal": principal,
        "rate": rate,
        "io_months": io_months,
        "amort_months": amort_months,
        "orig_fee": orig_fee,
        "eot_fee": eot_fee,
        "warrant_fmv": warrant_fmv,
    }
    schedule = build_schedule(inp)
    cash_flows = [-principal + orig_fee] + [r["total_payment"] for r in schedule]
    monthly_irr = solve_irr_bisection(cash_flows)
    eir = (1 + monthly_irr) ** 12 - 1
    total_inflows = sum(r["total_payment"] for r in schedule)
    moic = 0.0 if principal == 0 else total_inflows / principal
    total_interest = sum(r["interest"] for r in schedule)
    payload = {
        "eir": eir,
        "moic": moic,
        "total_interest": round(total_interest, 2),
        "fee_decomposition": {"orig_fee": orig_fee, "eot_fee": eot_fee, "warrant_fmv": warrant_fmv},
        "schedule": schedule,
    }
    _audit("calculate_term_loan_irr", {**inp, "ip_address": ip_address}, summarize({"eir": eir, "rows": len(schedule)}), ip_address)
    return payload


def calculate_note_irr(
    principal: float,
    annual_coupon_rate: float,
    term_months: int,
    upfront_fee: float,
    exit_fee: float,
    ip_address: str | None = None,
) -> dict[str, Any]:
    monthly_coupon = principal * (annual_coupon_rate / 12)
    flows = [-principal + upfront_fee]
    for m in range(1, term_months + 1):
        if m == term_months:
            flows.append(monthly_coupon + principal + exit_fee)
        else:
            flows.append(monthly_coupon)
    m_irr = solve_irr_bisection(flows)
    payload = {"eir": (1 + m_irr) ** 12 - 1, "cash_flow_schedule": flows}
    _audit(
        "calculate_note_irr",
        {
            "principal": principal,
            "annual_coupon_rate": annual_coupon_rate,
            "term_months": term_months,
            "upfront_fee": upfront_fee,
            "exit_fee": exit_fee,
            "ip_address": ip_address,
        },
        summarize(payload),
        ip_address,
    )
    return payload


def get_amort_schedule(deal_id: str, ip_address: str | None = None) -> dict[str, Any]:
    deal = find_deal_by_id(deal_id)
    if not deal:
        raise ValueError(f"Deal not found: {deal_id}")
    inp: LoanParams = {
        "principal": float(deal["principal"]),
        "rate": float(deal["rate"]),
        "io_months": int(deal["io_months"]),
        "amort_months": int(deal["amort_months"]),
        "orig_fee": float(deal["orig_fee"]),
        "eot_fee": float(deal["eot_fee"]),
        "warrant_fmv": float(deal["warrant_fmv"]),
    }
    schedule = build_schedule(inp)
    payload = {"deal_id": deal_id, "schedule": schedule}
    _audit("get_amort_schedule", {"deal_id": deal_id, "ip_address": ip_address}, summarize(payload), ip_address)
    return payload


ScenarioType = Literal["maturity_extension", "rate_stepup", "covenant_waiver"]


def run_restructure_scenario(
    deal_id: str,
    scenario_type: ScenarioType,
    params: dict[str, float],
    ip_address: str | None = None,
) -> dict[str, Any]:
    deal = find_deal_by_id(deal_id)
    if not deal:
        raise ValueError(f"Deal not found: {deal_id}")
    base: LoanParams = {
        "principal": float(deal["principal"]),
        "rate": float(deal["rate"]),
        "io_months": int(deal["io_months"]),
        "amort_months": int(deal["amort_months"]),
        "orig_fee": float(deal["orig_fee"]),
        "eot_fee": float(deal["eot_fee"]),
        "warrant_fmv": float(deal["warrant_fmv"]),
    }
    adjusted = dict(base)
    if scenario_type == "maturity_extension":
        adjusted["amort_months"] += max(1, int(params.get("extraMonths", 6)))
    elif scenario_type == "rate_stepup":
        adjusted["rate"] += float(params.get("rateStep", 0.01))
    elif scenario_type == "covenant_waiver":
        adjusted["eot_fee"] += float(params.get("feeReduction", 0))

    base_irr = (1 + solve_irr_bisection(build_cash_flows(base))) ** 12 - 1
    revised_schedule = build_schedule(adjusted)
    updated_irr = (1 + solve_irr_bisection(build_cash_flows(adjusted))) ** 12 - 1
    payload = {
        "updated_irr": updated_irr,
        "cash_flow_delta": updated_irr - base_irr,
        "recommendation_memo": f"Scenario {scenario_type} changes annualized IRR by {(updated_irr - base_irr):.4f}.",
        "revised_schedule": revised_schedule,
    }
    _audit(
        "run_restructure_scenario",
        {"deal_id": deal_id, "scenario_type": scenario_type, "params": params, "ip_address": ip_address},
        summarize(payload),
        ip_address,
    )
    return payload


def compare_before_after_irr(
    deal_id: str,
    scenario_type: ScenarioType,
    params: dict[str, float],
    ip_address: str | None = None,
) -> dict[str, Any]:
    run = run_restructure_scenario(deal_id, scenario_type, params, ip_address)
    deal = find_deal_by_id(deal_id)
    if not deal:
        raise ValueError(f"Deal not found: {deal_id}")
    base: LoanParams = {
        "principal": float(deal["principal"]),
        "rate": float(deal["rate"]),
        "io_months": int(deal["io_months"]),
        "amort_months": int(deal["amort_months"]),
        "orig_fee": float(deal["orig_fee"]),
        "eot_fee": float(deal["eot_fee"]),
        "warrant_fmv": float(deal["warrant_fmv"]),
    }
    before = (1 + solve_irr_bisection(build_cash_flows(base))) ** 12 - 1
    after = run["updated_irr"]
    payload = {
        "before_irr": before,
        "after_irr": after,
        "delta_bps": round((after - before) * 10000, 2),
        "breakdown_bps": {
            "rate_effect": round((params.get("rateStep", 0) or 0) * 10000, 2),
            "tenor_effect": round((params.get("extraMonths", 0) or 0) * 2, 2),
            "fee_effect": round((params.get("feeReduction", 0) or 0) / max(1, base["principal"]) * 10000, 2),
        },
    }
    _audit(
        "compare_before_after_irr",
        {"deal_id": deal_id, "scenario_type": scenario_type, "params": params, "ip_address": ip_address},
        summarize(payload),
        ip_address,
    )
    return payload


def compare_all_scenarios(deal_id: str, ip_address: str | None = None) -> list[dict[str, Any]]:
    scenarios: list[tuple[ScenarioType, dict[str, float]]] = [
        ("maturity_extension", {"extraMonths": 3}),
        ("maturity_extension", {"extraMonths": 6}),
        ("rate_stepup", {"rateStep": 0.01}),
        ("rate_stepup", {"rateStep": 0.02}),
        ("covenant_waiver", {"feeReduction": -25000}),
        ("covenant_waiver", {"feeReduction": -50000}),
    ]
    rows = []
    for st, pr in scenarios:
        comp = compare_before_after_irr(deal_id, st, pr, ip_address)
        rows.append(
            {
                "scenario_type": f"{st}:{json_dumps_slice(pr)}",
                "updated_irr": comp["after_irr"],
                "delta_bps": comp["delta_bps"],
            }
        )
    _audit("compare_all_scenarios", {"deal_id": deal_id, "ip_address": ip_address}, summarize({"rows": len(rows)}), ip_address)
    return rows


def get_outstanding_at_breach(
    deal_id: str,
    breach_month: int,
    ip_address: str | None = None,
) -> dict[str, Any]:
    deal = find_deal_by_id(deal_id)
    if not deal:
        raise ValueError(f"Deal not found: {deal_id}")
    schedule = build_schedule(
        {
            "principal": float(deal["principal"]),
            "rate": float(deal["rate"]),
            "io_months": int(deal["io_months"]),
            "amort_months": int(deal["amort_months"]),
            "orig_fee": float(deal["orig_fee"]),
            "eot_fee": float(deal["eot_fee"]),
            "warrant_fmv": float(deal["warrant_fmv"]),
        }
    )
    month = max(1, min(len(schedule), int(breach_month)))
    row = schedule[month - 1]
    payload = {
        "breach_month": month,
        "outstanding_balance": row["closing_balance"],
        "accrued_interest": row["interest"],
    }
    _audit(
        "get_outstanding_at_breach",
        {"deal_id": deal_id, "breach_month": breach_month, "ip_address": ip_address},
        summarize(payload),
        ip_address,
    )
    return payload


def calculate_dpo_breakeven(
    deal_id: str,
    settlement_month: int,
    ip_address: str | None = None,
) -> dict[str, Any]:
    deal = find_deal_by_id(deal_id)
    if not deal:
        raise ValueError(f"Deal not found: {deal_id}")
    base: LoanParams = {
        "principal": float(deal["principal"]),
        "rate": float(deal["rate"]),
        "io_months": int(deal["io_months"]),
        "amort_months": int(deal["amort_months"]),
        "orig_fee": float(deal["orig_fee"]),
        "eot_fee": float(deal["eot_fee"]),
        "warrant_fmv": float(deal["warrant_fmv"]),
    }
    target_eir = (1 + solve_irr_bisection(build_cash_flows(base))) ** 12 - 1
    month = max(1, int(settlement_month))
    schedule = build_schedule(base)
    at_month = schedule[min(month - 1, len(schedule) - 1)]
    outstanding = at_month["closing_balance"]

    lo = 0.0
    hi = 1.2
    for _ in range(80):
        mid = (lo + hi) / 2
        flows = [-base["principal"] + base["orig_fee"]]
        for m in range(1, month + 1):
            flows.append(schedule[m - 1]["total_payment"] if m - 1 < len(schedule) else 0.0)
        flows.append(outstanding * mid)
        eir = (1 + solve_irr_bisection(flows)) ** 12 - 1
        if eir < target_eir:
            lo = mid
        else:
            hi = mid
    payload = {"target_eir": target_eir, "breakeven_dpo_pct": round(((lo + hi) / 2) * 100, 2)}
    _audit(
        "calculate_dpo_breakeven",
        {"deal_id": deal_id, "settlement_month": settlement_month, "ip_address": ip_address},
        summarize(payload),
        ip_address,
    )
    return payload


def normal_cdf(x: float) -> float:
    t = 1 / (1 + 0.2316419 * abs(x))
    d = 0.3989423 * math.exp((-x * x) / 2)
    prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
    return 1 - prob if x > 0 else prob


def black_scholes_call(spot: float, strike: float, volatility: float, years: float, risk_free: float) -> float:
    if spot <= 0 or strike <= 0 or volatility <= 0 or years <= 0:
        return 0.0
    d1 = (math.log(spot / strike) + (risk_free + (volatility * volatility) / 2) * years) / (volatility * math.sqrt(years))
    d2 = d1 - volatility * math.sqrt(years)
    return spot * normal_cdf(d1) - strike * math.exp(-risk_free * years) * normal_cdf(d2)


def generate_warrant_irr(
    coverage: float,
    strike_val: float,
    fd_shares: float,
    scenarios: list[float],
    probabilities: list[float],
    ip_address: str | None = None,
) -> dict[str, Any]:
    spot = fd_shares * coverage
    bs_fmv = black_scholes_call(spot, strike_val, 0.45, 3, 0.04)
    payoffs = [max(0.0, ev * coverage - strike_val) for ev in scenarios]
    weighted = sum(payoffs[i] * (probabilities[i] if i < len(probabilities) else 0.0) for i in range(len(payoffs)))
    expected_irr = 0.0 if bs_fmv == 0 else weighted / bs_fmv - 1
    payload = {"black_scholes_fmv": bs_fmv, "scenario_payoffs": payoffs, "expected_irr": expected_irr}
    _audit(
        "generate_warrant_irr",
        {
            "coverage": coverage,
            "strike_val": strike_val,
            "fd_shares": fd_shares,
            "scenarios": scenarios,
            "probabilities": probabilities,
            "ip_address": ip_address,
        },
        summarize(payload),
        ip_address,
    )
    return payload


def calculate_warrant_irr(
    coverage: float,
    strike_val: float,
    fd_shares: float,
    scenarios: list[float],
    probabilities: list[float],
    ip_address: str | None = None,
) -> dict[str, Any]:
    base = generate_warrant_irr(coverage, strike_val, fd_shares, scenarios, probabilities, ip_address)
    rows = []
    for exit_value in scenarios:
        payoff = max(0.0, exit_value * coverage - strike_val)
        irr = 0.0 if base["black_scholes_fmv"] == 0 else payoff / base["black_scholes_fmv"] - 1
        rows.append({"exit_value": exit_value, "payoff": round(payoff, 2), "scenario_irr": round(irr, 6)})
    payload = {"black_scholes_fmv": base["black_scholes_fmv"], "scenarios": rows, "expected_irr": base["expected_irr"]}
    _audit("calculate_warrant_irr", {"ip_address": ip_address}, summarize(payload), ip_address)
    return payload


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
    ip_address: str | None = None,
) -> dict[str, Any]:
    probs = [p_up, p_flat, p_down]
    if abs(sum(probs) - 1) > 1e-6:
        raise ValueError("Probabilities must sum to 1")
    coupon = principal * coupon_rate * (term_months / 12)
    tree_specs = [
        ("up_round", p_up, up_round_value + coupon),
        ("flat_round", p_flat, flat_round_value + coupon),
        ("down_round", p_down, down_round_value + coupon),
    ]
    rows = []
    for name, p, payoff in tree_specs:
        flows = [-principal, payoff]
        irr_m = solve_irr_bisection(flows)
        rows.append({"scenario": name, "probability": p, "payoff": payoff, "irr": irr_m})
    expected_irr = sum(r["irr"] * r["probability"] for r in rows)
    payload = {"expected_irr": expected_irr, "scenario_tree": rows}
    _audit(
        "calculate_conv_note_irr",
        {
            "principal": principal,
            "term_months": term_months,
            "coupon_rate": coupon_rate,
            "ip_address": ip_address,
        },
        summarize(payload),
        ip_address,
    )
    return payload
