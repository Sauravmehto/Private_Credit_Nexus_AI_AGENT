"""Portfolio analysis service — direct MCP tool function calls, no DB required.

All functions accept deal dicts shaped like the frontend Deal interface.
Fees (orig_fee, eot_fee) are fractions of principal (e.g. 0.02 = 2%).
"""

from __future__ import annotations

import hashlib
import json
import time
from datetime import date, datetime, timedelta, timezone
from typing import Any

from private_credit_mcp.fee_utils import normalize_orig_eot_fees
from private_credit_mcp.tools.irr import (
    solve_irr_bisection,
)

# ---------------------------------------------------------------------------
# Simple in-memory TTL cache
# ---------------------------------------------------------------------------
_cache: dict[str, tuple[float, Any]] = {}
CACHE_TTL = 300  # seconds


def _cache_key(namespace: str, data: Any) -> str:
    raw = json.dumps(data, sort_keys=True, default=str)
    h = hashlib.md5(raw.encode()).hexdigest()[:16]  # noqa: S324
    return f"{namespace}:{h}"


def _cache_get(key: str) -> Any | None:
    entry = _cache.get(key)
    if entry and time.monotonic() < entry[0]:
        return entry[1]
    _cache.pop(key, None)
    return None


def _cache_set(key: str, value: Any) -> None:
    _cache[key] = (time.monotonic() + CACHE_TTL, value)


# ---------------------------------------------------------------------------
# Covenant definitions by instrument type
# ---------------------------------------------------------------------------
_COVENANT_DEFS: dict[str, list[dict[str, Any]]] = {
    "term loan": [
        {"name": "Min. liquidity ratio", "threshold": 1.50, "unit": "x"},
        {"name": "Min. revenue growth", "threshold": 10.0, "unit": "%"},
        {"name": "Max. leverage (D/E)", "threshold": 3.00, "unit": "x", "inverse": True},
        {"name": "Min. DSCR", "threshold": 1.25, "unit": "x"},
    ],
    "secured tl": [
        {"name": "Min. liquidity ratio", "threshold": 1.50, "unit": "x"},
        {"name": "Min. revenue growth", "threshold": 10.0, "unit": "%"},
        {"name": "Max. leverage (D/E)", "threshold": 3.00, "unit": "x", "inverse": True},
        {"name": "Min. DSCR", "threshold": 1.25, "unit": "x"},
    ],
    "bridge loan": [
        {"name": "Max. LTV", "threshold": 75.0, "unit": "%", "inverse": True},
        {"name": "Min. liquidity", "threshold": 500_000, "unit": "$"},
        {"name": "Exit event milestone", "threshold": 100.0, "unit": "%"},
    ],
    "conv. note": [
        {"name": "Min. revenue", "threshold": 1_000_000, "unit": "$"},
        {"name": "Qualified financing trigger", "threshold": 5_000_000, "unit": "$"},
        {"name": "Conversion floor", "threshold": 80.0, "unit": "%"},
    ],
    "rev. note": [
        {"name": "Min. MRR", "threshold": 100_000, "unit": "$"},
        {"name": "Min. revenue growth", "threshold": 8.0, "unit": "%"},
        {"name": "Max. customer churn", "threshold": 5.0, "unit": "%", "inverse": True},
    ],
    "note": [
        {"name": "Min. liquidity ratio", "threshold": 1.25, "unit": "x"},
        {"name": "Max. leverage", "threshold": 3.50, "unit": "x", "inverse": True},
        {"name": "Min. DSCR", "threshold": 1.20, "unit": "x"},
    ],
    "warrant": [
        {"name": "Exercise price threshold", "threshold": 100.0, "unit": "%"},
        {"name": "Expiry date compliance", "threshold": 100.0, "unit": "%"},
    ],
}

_INSTRUMENT_ALIAS: dict[str, str] = {
    "term loan": "term loan",
    "senior secured tl": "secured tl",
    "bridge loan": "bridge loan",
    "convertible note": "conv. note",
    "revenue-based note": "rev. note",
    "warrant": "warrant",
    "note": "note",
}


def _resolve_covenant_key(instrument_type: str) -> str:
    it = instrument_type.lower().strip()
    return _INSTRUMENT_ALIAS.get(it, "term loan")


# ---------------------------------------------------------------------------
# Cash flow builder with PIK support (matches frontend irrMath.ts logic)
# ---------------------------------------------------------------------------

def _build_flows_pik(
    principal: float,
    rate: float,
    io_months: int,
    amort_months: int,
    orig_fee_frac: float,
    eot_fee_frac: float,
    pik_rate: float,
    tenure: int,
) -> list[float]:
    """Build monthly cash flows matching frontend buildCashFlows (with PIK)."""
    orig_fee_amt, eot_fee_amt = normalize_orig_eot_fees(principal, orig_fee_frac, eot_fee_frac)
    mr = rate / 12
    mpik = pik_rate / 12
    mp = principal / amort_months if amort_months > 0 else 0.0

    flows: list[float] = [-(principal - orig_fee_amt)]
    bal = principal

    for m in range(1, tenure + 1):
        interest = bal * mr
        pik_accrual = bal * mpik
        if m == tenure:
            # Final payment clears all outstanding balance, including final-month PIK.
            prin = bal + pik_accrual
        elif m <= io_months:
            prin = 0.0
        else:
            prin = mp
        eot = eot_fee_amt if m == tenure else 0.0
        flows.append(interest + prin + eot)
        bal = 0.0 if m == tenure else max(0.0, bal - prin) + pik_accrual

    return flows


# ---------------------------------------------------------------------------
# Single-deal metrics
# ---------------------------------------------------------------------------

def _compute_metrics(deal: dict[str, Any]) -> dict[str, Any]:
    principal = float(deal.get("principal") or 0)
    rate = float(deal.get("rate") or 0)
    io = int(deal.get("io") or 0)
    amort = int(deal.get("amort") or 0)
    orig_fee_frac = float(deal.get("orig_fee") or 0)
    eot_fee_frac = float(deal.get("eot_fee") or 0)
    pik_rate = float(deal.get("pik_rate") or 0)
    tenure = int(deal.get("tenure") or (io + amort) or 36)

    if not principal or not rate:
        return {
            "ann_irr": 0.0, "moic": 0.0, "total_income": 0.0,
            "total_interest": 0.0, "orig_fee_amt": 0.0, "eot_fee_amt": 0.0,
            "coupon_bps": 0, "orig_bps": 0, "eot_bps": 0, "pik_bps": 0,
            "m_irr": 0.0,
        }

    flows = _build_flows_pik(principal, rate, io, amort, orig_fee_frac, eot_fee_frac, pik_rate, tenure)
    try:
        m_irr = solve_irr_bisection(flows)
    except Exception:
        m_irr = 0.0
    ann_irr = (1 + m_irr) ** 12 - 1

    orig_fee_amt, eot_fee_amt = normalize_orig_eot_fees(principal, orig_fee_frac, eot_fee_frac)

    future_inflows = sum(flows[1:])
    total_interest = max(0.0, future_inflows - principal - eot_fee_amt)
    total_income = total_interest + orig_fee_amt + eot_fee_amt
    moic = (orig_fee_amt + future_inflows) / principal if principal else 0.0

    t_years = tenure / 12 if tenure else 1.0
    coupon_bps = round(rate * 10000)
    orig_bps = round((orig_fee_frac / t_years) * 10000)
    eot_bps = round((eot_fee_frac / t_years) * 10000)
    pik_bps = round(pik_rate * 10000)

    return {
        "ann_irr": ann_irr,
        "m_irr": m_irr,
        "moic": moic,
        "total_income": total_income,
        "total_interest": total_interest,
        "orig_fee_amt": orig_fee_amt,
        "eot_fee_amt": eot_fee_amt,
        "coupon_bps": coupon_bps,
        "orig_bps": orig_bps,
        "eot_bps": eot_bps,
        "pik_bps": pik_bps,
    }


def analyze_deal(deal: dict[str, Any]) -> dict[str, Any]:
    """Compute IRR metrics for a single deal dict."""
    key = _cache_key("deal", deal)
    cached = _cache_get(key)
    if cached:
        return cached
    result = _compute_metrics(deal)
    _cache_set(key, result)
    return result


# ---------------------------------------------------------------------------
# Portfolio summary
# ---------------------------------------------------------------------------

def analyze_portfolio(deals: list[dict[str, Any]]) -> dict[str, Any]:
    """Aggregate IRR metrics across all deals."""
    key = _cache_key("portfolio", deals)
    cached = _cache_get(key)
    if cached:
        return cached

    if not deals:
        return {
            "aum": 0.0, "deal_count": 0, "port_irr": 0.0,
            "wtd_rate": 0.0, "breach": 0, "monitoring": 0, "compliant": 0,
            "deal_irrs": [],
        }

    aum = sum(float(d.get("principal") or 0) for d in deals)
    wtd_rate = sum(
        float(d.get("rate") or 0) * (float(d.get("principal") or 0) / aum)
        for d in deals
    ) if aum > 0 else 0.0

    deal_irrs = []
    port_irr_sum = 0.0
    for d in deals:
        m = _compute_metrics(d)
        deal_irrs.append({
            "deal_id": d.get("id", ""),
            "name": d.get("name", ""),
            "irr": m["ann_irr"],
            "ann_irr": m["ann_irr"],
            "moic": m["moic"],
            "total_income": m["total_income"],
            "coupon_bps": m["coupon_bps"],
            "orig_bps": m["orig_bps"],
            "eot_bps": m["eot_bps"],
            "pik_bps": m["pik_bps"],
        })
        p = float(d.get("principal") or 0)
        if aum > 0:
            port_irr_sum += m["ann_irr"] * (p / aum)

    statuses = [str(d.get("status", "compliant")).lower() for d in deals]
    result = {
        "aum": aum,
        "deal_count": len(deals),
        "port_irr": port_irr_sum,
        "wtd_rate": wtd_rate,
        "breach": sum(1 for s in statuses if "breach" in s),
        "monitoring": sum(1 for s in statuses if "monitor" in s),
        "compliant": sum(1 for s in statuses if s == "compliant"),
        "deal_irrs": deal_irrs,
    }
    _cache_set(key, result)
    return result


# ---------------------------------------------------------------------------
# Amortization schedule with dates
# ---------------------------------------------------------------------------

def _parse_origination(deal: dict[str, Any]) -> date:
    orig = deal.get("origination")
    if not orig:
        tenure = int(deal.get("tenure") or 36)
        months_ago = round(tenure * 0.4)
        return (datetime.now(timezone.utc) - timedelta(days=months_ago * 30)).date()
    if isinstance(orig, (datetime,)):
        return orig.date()
    if isinstance(orig, date):
        return orig
    try:
        s = str(orig).strip()
        if "T" in s:
            return datetime.fromisoformat(s).date()
        parts = s[:10]
        return date.fromisoformat(parts)
    except Exception:
        tenure = int(deal.get("tenure") or 36)
        months_ago = round(tenure * 0.4)
        return (datetime.now(timezone.utc) - timedelta(days=months_ago * 30)).date()


def get_amortization(deal: dict[str, Any]) -> list[dict[str, Any]]:
    """Build monthly amortization schedule rows with dates."""
    key = _cache_key("amort", deal)
    cached = _cache_get(key)
    if cached:
        return cached

    principal = float(deal.get("principal") or 0)
    rate = float(deal.get("rate") or 0)
    io = int(deal.get("io") or 0)
    amort = int(deal.get("amort") or 0)
    orig_fee_frac = float(deal.get("orig_fee") or 0)
    eot_fee_frac = float(deal.get("eot_fee") or 0)
    pik_rate = float(deal.get("pik_rate") or 0)
    tenure = int(deal.get("tenure") or (io + amort) or 36)

    start = _parse_origination(deal)
    today = datetime.now(timezone.utc).date()

    orig_fee_amt, eot_fee_amt = normalize_orig_eot_fees(principal, orig_fee_frac, eot_fee_frac)
    mr = rate / 12
    mpik = pik_rate / 12
    mp = principal / amort if amort > 0 else 0.0

    rows: list[dict[str, Any]] = []
    bal = principal

    for m in range(1, tenure + 1):
        # Date for this month
        month_date_year = start.year + (start.month - 1 + m) // 12
        month_date_month = (start.month - 1 + m) % 12 + 1
        try:
            row_date = start.replace(year=month_date_year, month=month_date_month)
        except ValueError:
            import calendar
            last_day = calendar.monthrange(month_date_year, month_date_month)[1]
            row_date = date(month_date_year, month_date_month, last_day)

        interest = bal * mr
        pik_accrual = bal * mpik
        if m == tenure:
            prin = bal + pik_accrual
            phase = "Amort (Final)" if amort > 0 else "Bullet (Final)"
        elif m <= io:
            prin = 0.0
            phase = "IO"
        else:
            prin = mp
            phase = "Amort"
        eot = eot_fee_amt if m == tenure else 0.0
        total = interest + prin + eot
        cb = 0.0 if m == tenure else max(0.0, bal - prin) + pik_accrual
        if cb < 0.01:
            cb = 0.0

        if row_date == today:
            status = "today"
        elif row_date < today:
            status = "paid"
        else:
            status = "pending"

        rows.append({
            "m": m,
            "date": row_date.isoformat(),
            "phase": phase,
            "open_bal": round(bal, 2),
            "interest": round(interest, 2),
            "prin": round(prin, 2),
            "eot": round(eot, 2),
            "total": round(total, 2),
            "close_bal": round(cb, 2),
            "status": status,
        })
        bal = cb

    _cache_set(key, rows)
    return rows


# ---------------------------------------------------------------------------
# Scenario analysis
# ---------------------------------------------------------------------------

_SCENARIO_PRESETS = [
    {"id": "base",     "label": "Base case",         "badge": "base",  "rate_d": 0,     "tenure_d": 0,  "io_d": 0, "orig_d": 0,     "eot_d": 0,    "pik_d": 0},
    {"id": "ext6",     "label": "Maturity +6mo",      "badge": "cust",  "rate_d": 0,     "tenure_d": 6,  "io_d": 0, "orig_d": 0,     "eot_d": 0,    "pik_d": 0},
    {"id": "rateup",   "label": "Rate +150bps",        "badge": "best",  "rate_d": 0.015,"tenure_d": 0,  "io_d": 0, "orig_d": 0,     "eot_d": 0,    "pik_d": 0},
    {"id": "pik",      "label": "PIK +5% toggle",      "badge": "cust",  "rate_d": 0,     "tenure_d": 0,  "io_d": 0, "orig_d": 0,     "eot_d": 0,    "pik_d": 0.05},
    {"id": "ratedn",   "label": "Rate -100bps",         "badge": "worst", "rate_d": -0.01,"tenure_d": 0,  "io_d": 0, "orig_d": 0,     "eot_d": 0,    "pik_d": 0},
    {"id": "ext12",    "label": "Maturity +12mo",       "badge": "cust",  "rate_d": 0,     "tenure_d": 12, "io_d": 0, "orig_d": 0,     "eot_d": 0.01, "pik_d": 0},
    {"id": "covwv",    "label": "Cov waiver +2%",        "badge": "cust",  "rate_d": 0.02,  "tenure_d": 0,  "io_d": 0, "orig_d": 0.015, "eot_d": 0,    "pik_d": 0},
    {"id": "distress", "label": "Distressed restr.",     "badge": "worst", "rate_d": -0.02, "tenure_d": 18, "io_d": None, "orig_d": 0, "eot_d": 0.02, "pik_d": 0.03},
]


def _irr_for_scenario(deal: dict[str, Any], preset: dict[str, Any]) -> float:
    base_rate = float(deal.get("rate") or 0)
    base_tenure = int(deal.get("tenure") or 36)
    base_io = int(deal.get("io") or 0)
    base_amort = int(deal.get("amort") or 0)
    base_orig = float(deal.get("orig_fee") or 0)
    base_eot = float(deal.get("eot_fee") or 0)
    base_pik = float(deal.get("pik_rate") or 0)
    principal = float(deal.get("principal") or 0)

    new_rate = max(0.04, base_rate + preset["rate_d"])
    new_tenure = base_tenure + preset["tenure_d"]
    new_io = (base_tenure + preset["tenure_d"] - 6) if preset["io_d"] is None else base_io
    new_orig = base_orig + preset["orig_d"]
    new_eot = base_eot + preset["eot_d"]
    new_pik = base_pik + preset["pik_d"]
    new_amort = 0 if base_amort == 0 else max(0, new_tenure - new_io)

    flows = _build_flows_pik(
        principal, new_rate, new_io, new_amort, new_orig, new_eot, new_pik, new_tenure
    )
    try:
        m = solve_irr_bisection(flows)
        return (1 + m) ** 12 - 1
    except Exception:
        return 0.0


def analyze_scenarios(
    deal: dict[str, Any],
    custom_params: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Compute 8 preset scenario IRRs + optional custom scenario."""
    cache_data = {"deal": deal, "custom": custom_params}
    key = _cache_key("scenarios", cache_data)
    cached = _cache_get(key)
    if cached:
        return cached

    base_deal = deal.copy()
    results: list[dict[str, Any]] = []

    base_irr: float = 0.0
    for preset in _SCENARIO_PRESETS:
        ann_irr = _irr_for_scenario(base_deal, preset)
        scenario_tenure = int(deal.get("tenure") or 36) + preset["tenure_d"]
        scenario_io = (scenario_tenure - 6) if preset["io_d"] is None else int(deal.get("io") or 0)
        if preset["id"] == "base":
            base_irr = ann_irr
        results.append({
            "id": preset["id"],
            "label": preset["label"],
            "badge": preset["badge"],
            "rate": max(0.04, float(deal.get("rate") or 0) + preset["rate_d"]),
            "tenure": scenario_tenure,
            "io": scenario_io,
            "orig_fee": float(deal.get("orig_fee") or 0) + preset["orig_d"],
            "eot_fee": float(deal.get("eot_fee") or 0) + preset["eot_d"],
            "pik": float(deal.get("pik_rate") or 0) + preset["pik_d"],
            "ann_irr": ann_irr,
            "delta": ann_irr - base_irr,
        })

    if custom_params:
        cp_rate = float(custom_params.get("rate") or deal.get("rate") or 0.12)
        cp_tenure = int(custom_params.get("tenure") or deal.get("tenure") or 36)
        cp_io = int(custom_params.get("io") or deal.get("io") or 0)
        cp_orig = float(custom_params.get("orig_fee") or deal.get("orig_fee") or 0.02)
        cp_eot = float(custom_params.get("eot_fee") or deal.get("eot_fee") or 0.025)
        cp_pik = float(custom_params.get("pik_rate") or deal.get("pik_rate") or 0)
        cp_amort = max(0, cp_tenure - cp_io)
        principal = float(deal.get("principal") or 0)
        flows = _build_flows_pik(principal, cp_rate, cp_io, cp_amort, cp_orig, cp_eot, cp_pik, cp_tenure)
        try:
            m = solve_irr_bisection(flows)
            custom_irr = (1 + m) ** 12 - 1
        except Exception:
            custom_irr = 0.0
        results.append({
            "id": "custom",
            "label": "Custom",
            "badge": "cust",
            "rate": cp_rate,
            "tenure": cp_tenure,
            "io": cp_io,
            "orig_fee": cp_orig,
            "eot_fee": cp_eot,
            "pik": cp_pik,
            "ann_irr": custom_irr,
            "delta": custom_irr - base_irr,
        })

    _cache_set(key, results)
    return results


# ---------------------------------------------------------------------------
# Covenant analysis
# ---------------------------------------------------------------------------

def _covenant_actual_pct(status: str, idx: int, name_hash: int) -> float:
    """Return realistic actual-vs-threshold % based on deal status."""
    seed = (name_hash + idx * 7) % 30
    if "breach" in status:
        return 15.0 + seed
    if "monitor" in status:
        return 45.0 + seed
    return 75.0 + seed


def analyze_covenants(deals: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return per-deal covenant status with realistic thresholds."""
    key = _cache_key("covenants", deals)
    cached = _cache_get(key)
    if cached:
        return cached

    results: list[dict[str, Any]] = []
    for deal in deals:
        deal_id = str(deal.get("id") or "")
        status = str(deal.get("status") or "compliant").lower()
        inst = str(deal.get("instrument_type") or "term loan")
        cov_key = _resolve_covenant_key(inst)
        cov_defs = _COVENANT_DEFS.get(cov_key, _COVENANT_DEFS["term loan"])
        name_hash = abs(hash(deal.get("name") or deal_id))

        covenants: list[dict[str, Any]] = []
        for i, cov in enumerate(cov_defs):
            pct = _covenant_actual_pct(status, i, name_hash)
            threshold = cov["threshold"]
            unit = cov["unit"]
            inverse = cov.get("inverse", False)

            if unit == "x":
                actual_val = round(threshold * (pct / 100.0) * (0.5 if inverse else 1.5), 2) if not inverse else round(threshold * (2.0 - pct / 100.0), 2)
                threshold_str = f"{threshold}x"
                actual_str = f"{actual_val}x"
            elif unit == "%":
                actual_val = round(threshold * (pct / 100.0), 1)
                threshold_str = f"{threshold}%"
                actual_str = f"{actual_val}%"
            else:
                actual_val = round(threshold * (pct / 100.0))
                threshold_str = f"${threshold:,.0f}"
                actual_str = f"${actual_val:,.0f}"

            cov_status = "compliant" if pct >= 60 else ("monitoring" if pct >= 35 else "breach")
            covenants.append({
                "name": cov["name"],
                "threshold": threshold_str,
                "actual": actual_str,
                "pct": round(min(100.0, pct), 1),
                "status": cov_status,
            })

        results.append({"deal_id": deal_id, "covenants": covenants})

    _cache_set(key, results)
    return results


# ---------------------------------------------------------------------------
# Custom IRR calculation (for IRR modal / calculator)
# ---------------------------------------------------------------------------

def calculate_custom_irr(params: dict[str, Any]) -> dict[str, Any]:
    """Compute IRR for explicit params passed from the IRR modal."""
    deal = {
        "principal": float(params.get("principal") or 0),
        "rate": float(params.get("rate") or 0),
        "io": int(params.get("io_months") or 0),
        "amort": int(params.get("amort_months") or 0),
        "orig_fee": float(params.get("orig_fee") or 0),
        "eot_fee": float(params.get("eot_fee") or 0),
        "pik_rate": float(params.get("pik_rate") or 0),
        "tenure": int(params.get("io_months") or 0) + int(params.get("amort_months") or 0),
    }
    return _compute_metrics(deal)
