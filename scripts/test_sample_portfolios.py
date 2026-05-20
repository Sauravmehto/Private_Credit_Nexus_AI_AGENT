#!/usr/bin/env python3
"""Upload each sample portfolio and write SAMPLE_PORTFOLIO_TEST_RESULTS.md."""

from __future__ import annotations

import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import httpx
except ImportError:
    print("Install httpx: pip install httpx", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
SAMPLES_DIR = ROOT / "frontend" / "public" / "samples"
API_BASE = "http://127.0.0.1:8000"
OUT_MD = ROOT / "database" / "SAMPLE_PORTFOLIO_TEST_RESULTS.md"

SAMPLES = [
    ("Sample 1", "nexus-fund-ii.xlsx"),
    ("Sample 2", "nexus-fund-iii.xlsx"),
    ("Sample 3", "nexus-fund-iv.xlsx"),
    ("Sample 4", "nexus-portfolio-4.xlsx"),
    ("Sample 5", "sample-portfolio.xlsx"),
]


def fmt_money(n: float) -> str:
    if n >= 1_000_000:
        return f"${n / 1_000_000:.2f}M"
    if n >= 1_000:
        return f"${n / 1_000:.1f}K"
    return f"${n:,.0f}"


def fmt_pct(n: float) -> str:
    if not math.isfinite(n):
        return "N/A"
    return f"{n * 100:.2f}%"


def test_one(client: httpx.Client, label: str, filename: str) -> dict:
    path = SAMPLES_DIR / filename
    result: dict = {
        "label": label,
        "filename": filename,
        "path": str(path),
        "exists": path.exists(),
        "upload_ok": False,
        "summary_ok": False,
        "metrics_ok": False,
        "overall": "FAIL",
        "deals": 0,
        "aum": 0.0,
        "port_irr": None,
        "errors": [],
        "missing_columns": [],
        "first_deal_id": None,
        "first_deal_irr": None,
    }

    if not path.exists():
        result["errors"].append(f"File not found: {path}")
        return result

    with path.open("rb") as f:
        resp = client.post(
            f"{API_BASE}/portfolio/upload",
            files={"file": (filename, f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
            timeout=60.0,
        )

    if resp.status_code != 200:
        try:
            body = resp.json()
            detail = body.get("detail", body)
            if isinstance(detail, dict):
                result["errors"].append(detail.get("message", str(detail)))
                result["missing_columns"] = detail.get("missing_columns", [])
            else:
                result["errors"].append(str(detail))
        except Exception:
            result["errors"].append(resp.text[:500] or f"HTTP {resp.status_code}")
        return result

    data = resp.json()
    deals = data.get("deals", [])
    result["upload_ok"] = True
    result["deals"] = len(deals)
    result["aum"] = sum(float(d.get("principal") or 0) for d in deals)

    if not deals:
        result["errors"].append("Upload returned zero deals")
        return result

    result["first_deal_id"] = deals[0].get("id")

    summary_resp = client.post(
        f"{API_BASE}/portfolio/summary",
        json={"deals": deals},
        timeout=60.0,
    )
    if summary_resp.status_code != 200:
        result["errors"].append(f"Summary failed: HTTP {summary_resp.status_code}")
        return result

    result["summary_ok"] = True
    summary = summary_resp.json()
    result["port_irr"] = summary.get("port_irr")
    if result["port_irr"] is not None and not math.isfinite(float(result["port_irr"])):
        result["errors"].append("Portfolio IRR is not finite")

    metrics_resp = client.post(
        f"{API_BASE}/deal/metrics",
        json={"deal": deals[0]},
        timeout=60.0,
    )
    if metrics_resp.status_code != 200:
        result["errors"].append(f"Deal metrics failed: HTTP {metrics_resp.status_code}")
        return result

    result["metrics_ok"] = True
    metrics = metrics_resp.json()
    result["first_deal_irr"] = metrics.get("ann_irr")

    if result["upload_ok"] and result["summary_ok"] and result["metrics_ok"] and not result["errors"]:
        result["overall"] = "PASS"
    return result


def build_markdown(results: list[dict], api_reachable: bool) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    passed = [r for r in results if r["overall"] == "PASS"]
    failed = [r for r in results if r["overall"] != "PASS"]

    lines = [
        "# Sample portfolio test results",
        "",
        f"**Run date:** {now}  ",
        f"**API:** `{API_BASE}`  ",
        f"**API reachable:** {'Yes' if api_reachable else 'No — start with `python -m uvicorn api.main:app --port 8000`'}  ",
        f"**Samples directory:** `{SAMPLES_DIR}`",
        "",
        "## Summary",
        "",
        f"| Result | Count |",
        f"|--------|-------|",
        f"| **PASS** | {len(passed)} |",
        f"| **FAIL** | {len(failed)} |",
        "",
        "| Sample | File | Upload | Deals | AUM | Port IRR | Summary | Deal metrics | Overall |",
        "|--------|------|--------|-------|-----|----------|---------|--------------|---------|",
    ]

    for r in results:
        upload = "PASS" if r["upload_ok"] else "FAIL"
        summary = "PASS" if r["summary_ok"] else "FAIL"
        metrics = "PASS" if r["metrics_ok"] else "FAIL"
        overall = f"**{r['overall']}**"
        irr = fmt_pct(float(r["port_irr"])) if r["port_irr"] is not None else "—"
        lines.append(
            f"| {r['label']} | `{r['filename']}` | {upload} | {r['deals']} | {fmt_money(r['aum'])} | {irr} | {summary} | {metrics} | {overall} |"
        )

    lines.extend(["", "## Correct results (PASS)", ""])
    if passed:
        for r in passed:
            lines.extend([
                f"### {r['label']} (`{r['filename']}`)",
                "",
                f"- Upload: PASS — **{r['deals']}** deals parsed",
                f"- AUM: **{fmt_money(r['aum'])}**",
                f"- Portfolio IRR: **{fmt_pct(float(r['port_irr']))}**" if r["port_irr"] is not None else "- Portfolio IRR: —",
                f"- First deal metrics (`{r['first_deal_id']}`): IRR **{fmt_pct(float(r['first_deal_irr']))}**" if r["first_deal_irr"] is not None else "",
                "",
            ])
    else:
        lines.append("_None — all samples failed._\n")

    lines.extend(["", "## Incorrect results (FAIL)", ""])
    if failed:
        for r in failed:
            lines.extend([
                f"### {r['label']} (`{r['filename']}`)",
                "",
            ])
            if not r["exists"]:
                lines.append(f"- **File missing** at `{r['path']}`")
            if r["missing_columns"]:
                lines.append(f"- **Missing columns:** {', '.join(r['missing_columns'])}")
            for err in r["errors"]:
                lines.append(f"- {err}")
            if not r["errors"] and r["deals"] == 0:
                lines.append("- No deals parsed from file")
            lines.append("")
    else:
        lines.append("_None — all samples passed._\n")

    lines.extend([
        "",
        "## How to re-run",
        "",
        "```bash",
        "cd private-credit-mcp",
        ".venv\\Scripts\\activate",
        "python -m uvicorn api.main:app --port 8000",
        "# other terminal:",
        "python scripts/test_sample_portfolios.py",
        "```",
        "",
        "## UI one-click load",
        "",
        "On the Connect screen, choose **Upload file**, then click any chip under **Try a sample portfolio** to load without browsing.",
        "",
    ])
    return "\n".join(lines)


def main() -> int:
    api_reachable = False
    results: list[dict] = []

    try:
        with httpx.Client() as client:
            try:
                health = client.get(f"{API_BASE}/health", timeout=5.0)
                api_reachable = health.status_code == 200
            except httpx.HTTPError:
                api_reachable = False

            if api_reachable:
                for label, filename in SAMPLES:
                    results.append(test_one(client, label, filename))
            else:
                for label, filename in SAMPLES:
                    results.append({
                        "label": label,
                        "filename": filename,
                        "path": str(SAMPLES_DIR / filename),
                        "exists": (SAMPLES_DIR / filename).exists(),
                        "upload_ok": False,
                        "summary_ok": False,
                        "metrics_ok": False,
                        "overall": "FAIL",
                        "deals": 0,
                        "aum": 0.0,
                        "port_irr": None,
                        "errors": ["API not reachable"],
                        "missing_columns": [],
                        "first_deal_id": None,
                        "first_deal_irr": None,
                    })
    except Exception as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    md = build_markdown(results, api_reachable)
    OUT_MD.write_text(md, encoding="utf-8")
    print(md.encode("ascii", errors="replace").decode("ascii"))
    print(f"\nWrote {OUT_MD}")
    return 0 if api_reachable and all(r["overall"] == "PASS" for r in results) else 1


if __name__ == "__main__":
    sys.exit(main())
