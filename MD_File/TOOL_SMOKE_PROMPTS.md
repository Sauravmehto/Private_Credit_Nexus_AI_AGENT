# Claude Desktop — smoke prompts & sample deal data

Use these **after** your API is running (`POST /chat` — local uvicorn or deployed Render service) and **`ANTHROPIC_API_KEY`** / **`MONGODB_URI`** are set as needed. You can paste them into the web UI or call the API with `curl` / a REST client.

**Before testing:** Run **`private-credit-seed`** against your MongoDB so `deals` contains rows (use `private_credit_mcp/data/seed_deals.json`). Deal **`id`** in Mongo matches **`deal_id`** from that file (e.g. `VD-2023-0101`).

**Primary deal IDs in the bundled seed (examples):**

| `deal_id`    | Company           | Sector              |
|-------------|-------------------|---------------------|
| `VD-2023-0101` | Axon Therapeutics | Healthcare / Biotech |
| `VD-2023-0102` | NovaDrive Systems | Clean Energy / EV    |
| `VD-2023-0105` | BlueSky Fintech   | **Fintech** (good for sector searches) |

---

## One-shot checklist (run everything)

Copy into Claude:

```text
Using only the private credit tools available to the agent, run these checks in order and summarize results:

1. get_portfolio_summary
2. get_deal_metrics for deal_id VD-2023-0101
3. get_deal_cash_flows for VD-2023-0101 with months 12
4. get_covenant_alerts
5. search_precedent_deals with sector "Fintech", deal_size_min 1000000, deal_size_max 15000000
6. search_comparable_deals with sector "Fintech", deal_size_min 1000000, deal_size_max 15000000, tolerance_pct 0.05
7. calculate_irr: principal 5000000, rate 0.14, io_months 6, amort_months 36, orig_fee 50000, eot_fee 25000, warrant_fmv 100000
8. calculate_term_loan_irr with the same parameters as (7)
9. calculate_note_irr: principal 2000000, annual_coupon_rate 0.12, term_months 24, upfront_fee 20000, exit_fee 15000
10. calculate_warrant_irr: coverage 0.12, strike_val 6500000, fd_shares 88000000, scenarios [50000000, 90000000, 150000000], probabilities [0.25, 0.5, 0.25]
11. generate_warrant_irr with the same parameters as (10)
12. calculate_conv_note_irr: principal 2000000, term_months 24, coupon_rate 0.1, up_round_value 3000000, flat_round_value 2300000, down_round_value 1700000, p_up 0.3, p_flat 0.4, p_down 0.3
13. get_amort_schedule for deal_id VD-2023-0101
14. run_restructure_scenario for VD-2023-0101, scenario_type rate_stepup, params {"rateStep": 0.02}
15. compare_before_after_irr for VD-2023-0101, scenario_type maturity_extension, params {"extraMonths": 6}
16. compare_all_scenarios for VD-2023-0101
17. get_outstanding_at_breach for VD-2023-0101, breach_month 6
18. calculate_dpo_breakeven for VD-2023-0101, settlement_month 12
19. generate_term_sheet: company_name "Test Borrower LLC", principal 3000000, rate 0.1215, io_months 12, amort_months 18, orig_fee 24900, eot_fee 96300, warrant_coverage 0
20. create_irr_model: instrument_type term_loan, params {"principal": 5000000, "rate": 0.14, "tenor_months": 42}
21. generate_restructure_memo for deal_id VD-2023-0101

Report pass/fail per step and paste condensed outputs.
```

---

## Individual prompts (one tool each)

Use these if you want isolated failures.

### Portfolio & Mongo-backed deals

**get_portfolio_summary**  
`Call get_portfolio_summary and report deal_count and total_aum.`

**get_deal_metrics**  
`Call get_deal_metrics with deal_id VD-2023-0101 and show IRR, MOIC, covenant_status, days_to_maturity.`

**get_deal_cash_flows**  
`Call get_deal_cash_flows with deal_id VD-2023-0101 and months 24; confirm monthly_cash_flows length is 24.`

**get_covenant_alerts**  
`Call get_covenant_alerts and list any deals with severity_score >= 0.8.`

**search_precedent_deals**  
`Call search_precedent_deals with sector "Fintech", deal_size_min 1000000, deal_size_max 15000000.`

**search_comparable_deals**  
`Call search_comparable_deals with sector "Fintech", deal_size_min 1000000, deal_size_max 15000000, tolerance_pct 0.1.`

### IRR & schedules (pure math or DB)

**calculate_irr**  
`Call calculate_irr with principal 5000000, rate 0.14, io_months 6, amort_months 36, orig_fee 50000, eot_fee 25000, warrant_fmv 100000; report eir.`

**calculate_term_loan_irr**  
`Same inputs as calculate_irr; confirm schedule length is io_months + amort_months (42).`

**calculate_note_irr**  
`Call calculate_note_irr with principal 2000000, annual_coupon_rate 0.12, term_months 24, upfront_fee 20000, exit_fee 15000.`

**get_amort_schedule**  
`Call get_amort_schedule with deal_id VD-2023-0101; confirm schedule rows exist.`

### Warrants & convertible

**calculate_warrant_irr**  
`Call calculate_warrant_irr with coverage 0.12, strike_val 6500000, fd_shares 88000000, scenarios [5e7,9e7,1.5e8], probabilities [0.25,0.5,0.25].`

**generate_warrant_irr**  
`Same parameters as calculate_warrant_irr; compare black_scholes_fmv and expected_irr.`

**calculate_conv_note_irr**  
`Call calculate_conv_note_irr with principal 2000000, term_months 24, coupon_rate 0.1, up_round_value 3000000, flat_round_value 2300000, down_round_value 1700000, p_up 0.3, p_flat 0.4, p_down 0.3.`

### Restructure & breach

**run_restructure_scenario**  
`Call run_restructure_scenario with deal_id VD-2023-0101, scenario_type rate_stepup, params containing rateStep 0.02.`

**compare_before_after_irr**  
`Call compare_before_after_irr with deal_id VD-2023-0101, scenario_type maturity_extension, params {"extraMonths": 6}.`

**compare_all_scenarios**  
`Call compare_all_scenarios with deal_id VD-2023-0101; expect 6 rows.`

**get_outstanding_at_breach**  
`Call get_outstanding_at_breach with deal_id VD-2023-0101, breach_month 10.`

**calculate_dpo_breakeven**  
`Call calculate_dpo_breakeven with deal_id VD-2023-0101, settlement_month 12.`

### Documents

**generate_term_sheet**  
`Call generate_term_sheet with company_name "Smoke Test Co", principal 3000000, rate 0.1215, io_months 12, amort_months 18, orig_fee 24900, eot_fee 96300, warrant_coverage 0; confirm output mentions Smoke Test Co.`

**create_irr_model**  
`Call create_irr_model with instrument_type term_loan and params {"principal": 5000000, "rate": 0.14}; confirm sheets include Inputs.`

**generate_restructure_memo**  
`Call generate_restructure_memo with deal_id VD-2023-0101; confirm memo text contains "Credit Committee Restructure Memo".`

---

## Minimal extra sample deals (JSON)

These match the **raw seed file shape** before `private-credit-seed` maps fields into Mongo (`deal_id` → `id`, ratios → dollar fees, etc.). Append to `private_credit_mcp/data/seed_deals.json` (valid JSON array), or save as a separate file and merge carefully.

```json
[
  {
    "deal_id": "TEST-2026-0001",
    "company_name": "Smoke Test Alpha Inc",
    "sector": "Fintech",
    "funding_stage": "Series A",
    "lead_vc": "Test VC",
    "founder_name": "Jane Doe",
    "instrument_type": "Term Loan",
    "close_date": "2026-01-01",
    "maturity_date": "2029-01-01",
    "days_to_maturity": 1000,
    "principal_usd": 5000000,
    "outstanding_balance_usd": 4500000,
    "interest_rate": 0.13,
    "io_months": 6,
    "amortization_months": 36,
    "origination_fee": 0.01,
    "end_of_term_fee": 0.03,
    "warrant_coverage": 0,
    "warrant_strike_val_usd": 0,
    "fully_diluted_shares": 100000000,
    "irr": 0.15,
    "moic": 1.2,
    "arr_usd": 0,
    "last_valuation_usd": 50000000,
    "runway_months": 18,
    "covenant_threshold_ratio": 1.3,
    "covenant_actual_ratio": 1.15,
    "covenant_status": "Watch",
    "notes": "Synthetic row for smoke tests."
  },
  {
    "deal_id": "TEST-2026-0002",
    "company_name": "Smoke Test Beta Ltd",
    "sector": "B2B SaaS",
    "funding_stage": "Series B",
    "lead_vc": "Another VC",
    "founder_name": "John Doe",
    "instrument_type": "Term Loan",
    "close_date": "2026-02-01",
    "maturity_date": "2028-08-01",
    "days_to_maturity": 900,
    "principal_usd": 8000000,
    "outstanding_balance_usd": 7200000,
    "interest_rate": 0.145,
    "io_months": 12,
    "amortization_months": 24,
    "origination_fee": 0.012,
    "end_of_term_fee": 0.025,
    "warrant_coverage": 0.05,
    "warrant_strike_val_usd": 500000,
    "fully_diluted_shares": 80000000,
    "irr": 0.16,
    "moic": 1.25,
    "arr_usd": 0,
    "last_valuation_usd": 120000000,
    "runway_months": 24,
    "covenant_threshold_ratio": 1.25,
    "covenant_actual_ratio": 1.28,
    "covenant_status": "Compliant",
    "notes": "Second synthetic row; use deal_id TEST-2026-0002 in prompts."
  }
```

After editing the seed file, run **`private-credit-seed`** again to upsert.

---

## Fee-ratio sanity check

`calculate_irr` / `calculate_term_loan_irr` / `generate_term_sheet` treat **`orig_fee` and `eot_fee` &lt; 1` as fractions of principal**. To test dollars explicitly, use values **≥ 1** (e.g. `50000` not `0.01` unless you intend 1% of principal).

---

## Disclaimer

Outputs are **analytical / illustrative**, not investment advice. Validate numbers independently.
