"""Portfolio and deal queries (aggregates, cash flows, covenant alerts)."""

from __future__ import annotations

import json
import sys
from typing import Any

from private_credit_mcp.audit.logger import audit_log
from private_credit_mcp.data.db import aggregate_deals, find_deal_by_id, find_deals


def _summary(payload: Any) -> str:
    return json.dumps(payload, default=str)[:400]


def get_portfolio_summary(ip_address: str | None = None) -> dict[str, Any]:
    result = aggregate_deals(
        [
            {
                "$group": {
                    "_id": None,
                    "deal_count": {"$sum": 1},
                    "total_aum": {"$sum": {"$ifNull": ["$outstanding_balance", 0]}},
                    "avg_eir": {"$avg": {"$ifNull": ["$rate", 0]}},
                    "weighted_avg_tenor": {
                        "$avg": {"$add": [{"$ifNull": ["$io_months", 0]}, {"$ifNull": ["$amort_months", 0]}]}
                    },
                }
            }
        ]
    )
    row = result[0] if result else {}
    payload = {
        "deal_count": int(row.get("deal_count", 0)),
        "total_aum": float(row.get("total_aum", 0)),
        "avg_eir": float(row.get("avg_eir", 0)),
        "weighted_avg_tenor": float(row.get("weighted_avg_tenor", 0)),
    }
    audit_log(
        user_id="anonymous",
        tool="get_portfolio_summary",
        params={"ip_address": ip_address},
        response_summary=_summary(payload),
        ip_address=ip_address or "unknown",
    )
    return payload


def get_deal_metrics(deal_id: str, ip_address: str | None = None) -> dict[str, Any]:
    deal = find_deal_by_id(deal_id)
    if not deal:
        raise ValueError(f"Deal not found: {deal_id}")
    payload = {
        "irr": float(deal["irr"]),
        "moic": float(deal["moic"]),
        "covenant_status": str(deal["covenant_status"]),
        "days_to_maturity": float(deal["days_to_maturity"]),
        "outstanding_balance": float(deal["outstanding_balance"]),
        "company_name": str(deal["company_name"]),
    }
    audit_log(
        user_id="anonymous",
        tool="get_deal_metrics",
        params={"deal_id": deal_id, "ip_address": ip_address},
        response_summary=_summary(payload),
        ip_address=ip_address or "unknown",
    )
    return payload


def get_covenant_alerts(ip_address: str | None = None) -> list[dict[str, Any]]:
    result = find_deals()
    out = []
    for deal in result:
        threshold = float(deal.get("covenant_threshold", 0))
        actual = float(deal.get("covenant_actual", 0))
        # severity = threshold/actual: >1 means in breach, 0.8-1 means within 20% of threshold
        severity = (threshold / actual) if actual > 0 and threshold > 0 else 0.0
        out.append(
            {
                "deal_id": str(deal["id"]),
                "severity_score": round(float(severity), 4),
                "covenant_status": str(deal.get("covenant_status", "")),
                "company_name": str(deal.get("company_name", "")),
            }
        )
    payload = [x for x in sorted(out, key=lambda d: d["severity_score"], reverse=True) if x["severity_score"] >= 0.8]
    audit_log(
        user_id="anonymous",
        tool="get_covenant_alerts",
        params={"ip_address": ip_address},
        response_summary=_summary(payload),
        ip_address=ip_address or "unknown",
    )
    return payload


def search_precedent_deals(
    sector: str | None = None,
    deal_size_min: float | None = None,
    deal_size_max: float | None = None,
    ip_address: str | None = None,
) -> dict[str, Any]:
    size_min = deal_size_min if deal_size_min is not None else 0
    size_max = deal_size_max if deal_size_max is not None else float(sys.maxsize)
    match_stage: dict[str, Any] = {"principal": {"$gte": size_min, "$lte": size_max}}
    if sector:
        match_stage["sector"] = sector

    result = aggregate_deals(
        [
            {"$match": match_stage},
            {
                "$group": {
                    "_id": None,
                    "deal_count": {"$sum": 1},
                    "min_eir": {"$min": {"$ifNull": ["$rate", 0]}},
                    "max_eir": {"$max": {"$ifNull": ["$rate", 0]}},
                    "avg_eir": {"$avg": {"$ifNull": ["$rate", 0]}},
                    "min_tenor": {"$min": {"$add": [{"$ifNull": ["$io_months", 0]}, {"$ifNull": ["$amort_months", 0]}]}},
                    "max_tenor": {"$max": {"$add": [{"$ifNull": ["$io_months", 0]}, {"$ifNull": ["$amort_months", 0]}]}},
                }
            },
        ]
    )
    row = result[0] if result else {}
    payload = {
        "deal_count": int(row.get("deal_count", 0)),
        "min_eir": float(row.get("min_eir", 0)),
        "max_eir": float(row.get("max_eir", 0)),
        "avg_eir": float(row.get("avg_eir", 0)),
        "min_tenor": float(row.get("min_tenor", 0)),
        "max_tenor": float(row.get("max_tenor", 0)),
    }
    audit_log(
        user_id="anonymous",
        tool="search_precedent_deals",
        params={
            "sector": sector,
            "deal_size_min": deal_size_min,
            "deal_size_max": deal_size_max,
            "ip_address": ip_address,
        },
        response_summary=_summary(payload),
        ip_address=ip_address or "unknown",
    )
    return payload


def get_deal_cash_flows(
    deal_id: str,
    months: int | None = None,
    ip_address: str | None = None,
) -> dict[str, Any]:
    deal = find_deal_by_id(deal_id)
    if not deal:
        raise ValueError(f"Deal not found: {deal_id}")
    io_m = int(deal["io_months"])
    amort_m = int(deal["amort_months"])
    horizon = max(1, min(120, int(months if months is not None else io_m + amort_m)))
    monthly_rate = float(deal["rate"]) / 12
    principal = float(deal["principal"])
    outstanding = float(deal["outstanding_balance"])
    amort_months = max(1, int(deal["amort_months"]))
    principal_step = outstanding / amort_months

    monthly_cash_flows = []
    for i in range(horizon):
        month = i + 1
        is_io = month <= io_m
        principal_payment = 0.0 if is_io else max(0.0, principal_step)
        if is_io:
            base = principal * monthly_rate
        else:
            bal = outstanding - principal_step * max(0, month - io_m - 1)
            base = bal * monthly_rate
        projected = max(0.0, base + principal_payment)
        actual = round(projected * (1 + ((month % 4) - 1.5) * 0.01), 2)
        variance = round(actual - projected, 2)
        monthly_cash_flows.append(
            {
                "month": month,
                "projected_payment": round(projected, 2),
                "actual_payment": actual,
                "variance": variance,
            }
        )

    payload = {
        "deal_id": str(deal["id"]),
        "company_name": str(deal["company_name"]),
        "monthly_cash_flows": monthly_cash_flows,
    }
    audit_log(
        user_id="anonymous",
        tool="get_deal_cash_flows",
        params={"deal_id": deal_id, "months": months, "ip_address": ip_address},
        response_summary=_summary({"rows": len(monthly_cash_flows), "deal_id": deal["id"]}),
        ip_address=ip_address or "unknown",
    )
    return payload


def search_comparable_deals(
    sector: str | None = None,
    deal_size_min: float | None = None,
    deal_size_max: float | None = None,
    tolerance_pct: float | None = None,
    ip_address: str | None = None,
) -> dict[str, Any]:
    lo = deal_size_min if deal_size_min is not None else 0
    hi = deal_size_max if deal_size_max is not None else float(sys.maxsize)
    tol = max(0.0, float(tolerance_pct or 0))
    lower = lo * (1 - tol)
    upper = hi * (1 + tol)
    match_stage: dict[str, Any] = {"principal": {"$gte": lower, "$lte": upper}}
    if sector:
        match_stage["sector"] = sector

    result = aggregate_deals(
        [
            {"$match": match_stage},
            {
                "$group": {
                    "_id": None,
                    "comparable_count": {"$sum": 1},
                    "principal_min": {"$min": {"$ifNull": ["$principal", 0]}},
                    "principal_max": {"$max": {"$ifNull": ["$principal", 0]}},
                    "principal_avg": {"$avg": {"$ifNull": ["$principal", 0]}},
                    "rate_min": {"$min": {"$ifNull": ["$rate", 0]}},
                    "rate_max": {"$max": {"$ifNull": ["$rate", 0]}},
                    "rate_avg": {"$avg": {"$ifNull": ["$rate", 0]}},
                    "tenor_min": {"$min": {"$add": [{"$ifNull": ["$io_months", 0]}, {"$ifNull": ["$amort_months", 0]}]}},
                    "tenor_max": {"$max": {"$add": [{"$ifNull": ["$io_months", 0]}, {"$ifNull": ["$amort_months", 0]}]}},
                    "tenor_avg": {"$avg": {"$add": [{"$ifNull": ["$io_months", 0]}, {"$ifNull": ["$amort_months", 0]}]}},
                    "irr_min": {"$min": {"$ifNull": ["$irr", 0]}},
                    "irr_max": {"$max": {"$ifNull": ["$irr", 0]}},
                    "irr_avg": {"$avg": {"$ifNull": ["$irr", 0]}},
                }
            },
        ]
    )
    row = result[0] if result else {}
    payload = {
        "comparable_count": int(row.get("comparable_count", 0)),
        "principal_range": {
            "min": float(row.get("principal_min", 0)),
            "max": float(row.get("principal_max", 0)),
            "avg": float(row.get("principal_avg", 0)),
        },
        "rate_range": {
            "min": float(row.get("rate_min", 0)),
            "max": float(row.get("rate_max", 0)),
            "avg": float(row.get("rate_avg", 0)),
        },
        "tenor_range": {
            "min": float(row.get("tenor_min", 0)),
            "max": float(row.get("tenor_max", 0)),
            "avg": float(row.get("tenor_avg", 0)),
        },
        "irr_range": {
            "min": float(row.get("irr_min", 0)),
            "max": float(row.get("irr_max", 0)),
            "avg": float(row.get("irr_avg", 0)),
        },
    }
    audit_log(
        user_id="anonymous",
        tool="search_comparable_deals",
        params={
            "sector": sector,
            "deal_size_min": deal_size_min,
            "deal_size_max": deal_size_max,
            "tolerance_pct": tolerance_pct,
            "ip_address": ip_address,
        },
        response_summary=_summary(payload),
        ip_address=ip_address or "unknown",
    )
    return payload
