from __future__ import annotations

from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import HTTPException

from api.services import portfolio_service as ps
from api.services.tool_execution import (
    ToolTracker,
    anthropic_key_configured,
    build_agent_graph,
    extract_final_answer,
)

load_dotenv(Path(__file__).resolve().parents[2] / ".env")


def _fmt_money(value: float) -> str:
    return f"${value:,.0f}"


def _fmt_pct(value: float) -> str:
    return f"{value * 100:.2f}%"


async def generate_portfolio_ai_summary(deals: list[dict[str, Any]]) -> dict[str, Any]:
    """Generate MCP-tool-assisted Anthropic commentary over deterministic portfolio metrics."""
    if not anthropic_key_configured():
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY is not configured.")

    metrics = ps.analyze_portfolio(deals)
    deal_irrs = {row["deal_id"]: row for row in metrics["deal_irrs"]}

    deal_lines = []
    for d in deals:
        irr_row = deal_irrs.get(d.get("id", ""), {})
        deal_lines.append(
            "- "
            f"{d.get('name', 'Unknown')} | "
            f"{d.get('instrument_type', 'n/a')} | "
            f"sector={d.get('sector', 'n/a')} | "
            f"stage={d.get('stage', 'n/a')} | "
            f"principal={_fmt_money(float(d.get('principal') or 0))} | "
            f"coupon={_fmt_pct(float(d.get('rate') or 0))} | "
            f"EIR={_fmt_pct(float(irr_row.get('ann_irr') or 0))} | "
            f"MOIC={float(irr_row.get('moic') or 0):.2f}x | "
            f"status={d.get('status', 'n/a')}"
        )

    prompt = f"""
You are a senior private credit portfolio analyst. Use the deterministic metrics below as the source of truth.
Do not invent missing facts. The uploaded Excel deals below are the active portfolio; do not assume MongoDB has these records.

Use MCP/private-credit tools wherever they fit the task:
- Portfolio: get_portfolio_summary
- Deal analytics: calculate_irr, calculate_term_loan_irr, calculate_note_irr, calculate_warrant_irr, calculate_conv_note_irr, get_deal_metrics, get_deal_cash_flows
- Amortization/covenants: get_amort_schedule, get_covenant_alerts, get_outstanding_at_breach
- Scenarios/restructure: compare_all_scenarios, compare_before_after_irr, run_restructure_scenario, calculate_dpo_breakeven, generate_restructure_memo
- Market intelligence/docs: search_comparable_deals, search_precedent_deals, generate_term_sheet, create_irr_model, generate_warrant_irr

Important tool guidance:
- Uploaded deals may not exist in the MCP sample database, so when a tool accepts raw parameters, use the uploaded deal parameters.
- For tools that require stored deal_id, call them only when you can map a valid deal_id; if the tool cannot apply, say so briefly.
- Call relevant tools before writing the answer. At minimum, use:
  1. get_portfolio_summary as an MCP portfolio cross-check.
  2. calculate_irr/calculate_term_loan_irr/calculate_note_irr for representative uploaded deals using raw parameters.
  3. get_covenant_alerts for credit-risk context.
  4. search_comparable_deals or search_precedent_deals for the largest sectors.
  5. compare_all_scenarios, compare_before_after_irr, run_restructure_scenario, get_amort_schedule, get_deal_cash_flows, get_outstanding_at_breach, calculate_dpo_breakeven, or generate_restructure_memo when a valid stored deal_id is available.
- If a tool result conflicts with the deterministic uploaded-deal metrics, trust the deterministic uploaded-deal metrics and explain the MCP result was used as a cross-check.

Portfolio metrics:
- AUM: {_fmt_money(float(metrics["aum"]))}
- Deal count: {metrics["deal_count"]}
- Weighted cash coupon: {_fmt_pct(float(metrics["wtd_rate"]))}
- Portfolio all-in EIR: {_fmt_pct(float(metrics["port_irr"]))}
- Compliant deals: {metrics["compliant"]}
- Monitoring deals: {metrics["monitoring"]}
- Breach-risk deals: {metrics["breach"]}

Deals:
{chr(10).join(deal_lines)}

Return concise markdown with these sections:
## Executive Summary
2-3 sentences.

## Key Metrics
Bullets for AUM, portfolio EIR, weighted coupon, and health split.

## Main Risks
3 bullets, prioritized.

## Recommended Actions
3-5 practical lender actions.

## MCP Tool Cross-Checks
Briefly list which MCP tools were used and what they confirmed.
"""

    tracker = ToolTracker()
    try:
        result = await build_agent_graph("anthropic").ainvoke(
            {"messages": [{"role": "user", "content": prompt}]},
            config={"callbacks": [tracker]},
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"MCP portfolio AI summary failed: {type(exc).__name__}") from exc

    text = extract_final_answer(result if isinstance(result, dict) else {})
    return {"summary": text.strip(), "metrics": metrics, "tool_calls": tracker.calls}
