# MongoDB setup (Python)

## Atlas cluster and connection string

1. Create a free **MongoDB Atlas** cluster and database user (read/write).
2. Allow your IP in **Network Access** (or `0.0.0.0/0` for local dev only).
3. In **Connect → Drivers**, pick **Python** and copy the SRV URI.
4. Add the **database name** as the path segment before the query string (this is the database the app and seeder use), e.g.  
   `mongodb+srv://user:pass@cluster.xxxxx.mongodb.net/private_credit?retryWrites=true&w=majority`  
   If you use `/my_app` instead, data is read and written under **`my_app`** — **`private-credit-seed` uses the same name** as the running server (parsed from the URI). Seeding into a different DB than the URI path is a common cause of “deal not found” on Render.
5. Set **`MONGODB_URI`** in a `.env` file at the project root (or export it in your shell).

## Load sample deals

From the project root, with the virtual environment active:

```bash
pip install -e .
private-credit-seed
```

This reads `private_credit_mcp/data/seed_deals.json` and upserts into **`<database_from_uri>.deals`** (mapped fields such as `id`, `principal`, `rate`, …).

The **`audit_logs`** collection is filled automatically when tools run (optional).

## Sample CSV vs canonical seed

[`database/sample_deals.csv`](../database/sample_deals.csv) is a **narrow, human-readable export** (columns such as `deal_id`, `principal_usd`, `io_months`). The seeder does **not** read this file. **Canonical seed data** is [`private_credit_mcp/data/seed_deals.json`](../private_credit_mcp/data/seed_deals.json) (full fields: `founder_name`, `close_date`, covenant ratios, etc.). Keep JSON in sync when you change the CSV, or extend the repo with a small CSV→JSON script if you want CSV-driven updates.

## Verify

In Atlas → **Browse Collections**, open **`<your_database_name>.deals`** (same name as in `MONGODB_URI`) and confirm documents exist after seeding.
