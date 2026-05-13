"""Document generators (term sheet, IRR layout JSON, restructure memo)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Literal

from private_credit_mcp.audit.logger import audit_log
from private_credit_mcp.data.db import find_deal_by_id
from private_credit_mcp.tools.irr import calculate_irr_value


def _repo_root() -> Path:
    """Resolve directory containing templates/ (installed package or repo root)."""
    tools_dir = Path(__file__).resolve().parent
    pkg_templates = tools_dir.parent / "templates" / "term_sheet.txt"
    if pkg_templates.is_file():
        return tools_dir.parent
    for p in [tools_dir, *tools_dir.parents]:
        if (p / "templates" / "term_sheet.txt").is_file():
            return p
    return Path(__file__).resolve().parents[2]


def _summarize(payload: Any) -> str:
    return json.dumps(payload, default=str)[:400]


def generate_term_sheet(
    company_name: str,
    principal: float,
    rate: float,
    io_months: int,
    amort_months: int,
    orig_fee: float,
    eot_fee: float,
    warrant_coverage: float,
    ip_address: str | None = None,
) -> str:
    template_path = _repo_root() / "templates" / "term_sheet.txt"
    template = template_path.read_text(encoding="utf-8")
    output = (
        template.replace("[REDACTED]", company_name)
        .replace("[AMOUNT]", f"{principal:.2f}")
        .replace("[TENOR]", str(io_months + amort_months))
        .replace("[RATE]", f"{rate:.4f}")
        .replace("[SECURITY PACKAGE]", "Senior secured with standard collateral package")
        .replace("[KEY COVENANTS]", "Leverage and liquidity maintenance tests")
    )
    audit_log(
        user_id="anonymous",
        tool="generate_term_sheet",
        params={
            "company_name": company_name,
            "principal": principal,
            "rate": rate,
            "io_months": io_months,
            "amort_months": amort_months,
            "orig_fee": orig_fee,
            "eot_fee": eot_fee,
            "warrant_coverage": warrant_coverage,
            "ip_address": ip_address,
        },
        response_summary=_summarize({"length": len(output)}),
        ip_address=ip_address or "unknown",
    )
    return output


def create_irr_model(
    instrument_type: Literal["term_loan", "revolver", "convertible"],
    params: dict[str, Any],
    ip_address: str | None = None,
) -> dict[str, Any]:
    layout: dict[str, Any] = {
        "sheets": [
            {
                "name": "Inputs",
                "columns": ["Parameter", "Value"],
                "rows": [{"parameter": k, "value": v} for k, v in params.items()],
            },
            {"name": "CashFlows", "columns": ["Period", "OpeningBalance", "Interest", "Principal", "TotalCashFlow"]},
            {
                "name": "Outputs",
                "columns": ["Metric", "Value"],
                "formulas": ["IRR=IRR(CashFlows!E:E)", "MOIC=SUM(CashFlows!E:E)/ABS(CashFlows!E2)"],
            },
        ],
        "instrument_type": instrument_type,
    }
    audit_log(
        user_id="anonymous",
        tool="create_irr_model",
        params={"instrument_type": instrument_type, "ip_address": ip_address},
        response_summary=_summarize(layout),
        ip_address=ip_address or "unknown",
    )
    return layout


def generate_restructure_memo(deal_id: str, ip_address: str | None = None) -> str:
    deal = find_deal_by_id(deal_id)
    if not deal:
        raise ValueError(f"Deal not found: {deal_id}")

    principal = float(deal["principal"])
    rate = float(deal["rate"])
    scenarios = [
        ("Maturity Extension +6m", -0.003),
        ("Maturity Extension +12m", -0.006),
        ("Rate Step-Up +100bps", 0.01),
        ("Rate Step-Up +200bps", 0.02),
        ("Covenant Waiver", -0.002),
        ("Partial Paydown + Fee", 0.004),
    ]

    base_cash_flows = [-principal + float(deal["orig_fee"])] + [(principal * rate) / 12] * int(deal["io_months"])
    base_cash_flows.append(principal + float(deal["eot_fee"]) + float(deal["warrant_fmv"]))
    base_irr = (1 + calculate_irr_value(base_cash_flows)) ** 12 - 1

    scenario_text = "\n".join(f"{title}: projected IRR {(base_irr + bump):.4f}" for title, bump in scenarios)

    memo = "\n".join(
        [
            "Credit Committee Restructure Memo",
            f"Deal: {deal_id}",
            f"Borrower: {deal['company_name']}",
            f"Current IRR: {base_irr:.4f}",
            "",
            "Scenario Review:",
            scenario_text,
            "",
            "Recommendation:",
            "Proceed with structure balancing extension and rate support while maintaining covenant monitoring.",
        ]
    )

    audit_log(
        user_id="anonymous",
        tool="generate_restructure_memo",
        params={"deal_id": deal_id, "ip_address": ip_address},
        response_summary=_summarize({"length": len(memo)}),
        ip_address=ip_address or "unknown",
    )
    return memo
