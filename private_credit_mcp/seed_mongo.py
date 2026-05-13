"""Upsert sample deals from private_credit_mcp/data/seed_deals.json into MongoDB."""

from __future__ import annotations

import json
import os
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

from private_credit_mcp.data.db import resolve_db_name

load_dotenv()


def seed_json_path() -> Path:
    p = Path(__file__).resolve().parent / "data" / "seed_deals.json"
    if not p.is_file():
        raise FileNotFoundError(f"Missing seed data: {p}")
    return p


def main() -> None:
    uri = os.environ.get("MONGODB_URI")
    if not uri:
        raise SystemExit("MONGODB_URI is not set in the environment")

    seed_path = seed_json_path()
    if not seed_path.is_file():
        raise SystemExit(f"Seed file not found: {seed_path}")

    seed_deals: list[dict] = json.loads(seed_path.read_text(encoding="utf-8"))

    db_name = resolve_db_name(uri)
    client = MongoClient(uri)
    try:
        db = client[db_name]
        deals = db["deals"]

        upserted = 0
        for d in seed_deals:
            mapped = {
                "id": d["deal_id"],
                "company_name": d["company_name"],
                "sector": d["sector"],
                "funding_stage": d["funding_stage"],
                "lead_vc": d["lead_vc"],
                "founder_name": d["founder_name"],
                "instrument_type": d["instrument_type"],
                "close_date": d["close_date"],
                "maturity_date": d["maturity_date"],
                "days_to_maturity": d["days_to_maturity"],
                "principal": d["principal_usd"],
                "outstanding_balance": d["outstanding_balance_usd"],
                "rate": d["interest_rate"],
                "io_months": d["io_months"],
                "amort_months": d["amortization_months"],
                "orig_fee": round(d["origination_fee"] * d["principal_usd"]),
                "eot_fee": round(d["end_of_term_fee"] * d["principal_usd"]),
                "warrant_coverage": d["warrant_coverage"],
                "warrant_fmv": d["warrant_strike_val_usd"],
                "fully_diluted_shares": d["fully_diluted_shares"],
                "irr": d["irr"],
                "moic": d["moic"],
                "arr_usd": d["arr_usd"],
                "last_valuation_usd": d["last_valuation_usd"],
                "runway_months": d["runway_months"],
                "covenant_threshold": d["covenant_threshold_ratio"],
                "covenant_actual": d["covenant_actual_ratio"],
                "covenant_status": d["covenant_status"],
                "notes": d["notes"],
            }
            deals.update_one({"id": mapped["id"]}, {"$set": mapped}, upsert=True)
            upserted += 1
            print(f"  Upserted: {mapped['id']} — {mapped['company_name']}")

        print(f"\nSeed complete. {upserted} deals upserted into {db_name}.deals")
        print(f"Total deals in collection: {deals.count_documents({})}")
    finally:
        client.close()


if __name__ == "__main__":
    main()
