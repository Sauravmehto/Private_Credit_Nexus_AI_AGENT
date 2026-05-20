# Sample Portfolio Load — Technical Overview

**Product:** Private Credit Analyst (PrivateCreditNexusAI)  
**Audience:** Engineering / product review  
**Last updated:** May 2026

---

## How Excel upload works (short)

When you upload an Excel file (drag-drop, **Choose portfolio file**, or **Sample Load**), the same pipeline runs:

1. **Browser** — Your `.xlsx` is sent to the API as a file upload (`POST /portfolio/upload`).
2. **Backend** — FastAPI receives the file and calls `parse_upload_full()` in `api/services/upload_service.py` (see `api/main.py`).
3. **Read Excel** — `openpyxl` opens the workbook, picks the sheet that looks most like a deal table, and finds the header row (Borrower, Principal, Rate, etc.).
4. **Validate** — Required columns must be present (names can vary slightly, e.g. “Company” counts as Borrower).
5. **Convert rows** — Each data row becomes one **Deal** object (principal, rate, tenure, fees, covenant status, etc.).
6. **Response** — API returns `{ deals: [...], filename: "..." }` as JSON.
7. **UI** — React saves those deals, calls `/portfolio/summary` for IRR/AUM, and shows the **Portfolio** screen.

If columns are missing or the file type is wrong, you get an error (or the validation modal) and nothing is loaded.

**Sample vs your own file:** Samples only skip step 1’s file picker — they `fetch` a file from `public/samples/` first, then use the **same** upload API and steps 2–7.

---

## 1. Purpose

The Connect screen offers **five one-click sample portfolios** so clients and internal stakeholders can explore IRR analysis, covenant tracking, restructure scenarios, and portfolio analytics **without uploading their own Excel file**.

- **Load** — fetches the sample, uploads it to the backend, and opens the main app (same path as a manual file upload).
- **↓ (download)** — downloads the `.xlsx` only; does not load data into the app.

---

## 2. User flow (demo / UAT)

| Step | Action | Result |
|------|--------|--------|
| 1 | Open the app (`http://localhost:5173` in dev) | Connect screen appears |
| 2 | Confirm **Upload file** is selected | Drop zone and sample chips are visible |
| 3 | Click **Sample 1** … **Sample 5** → **Load** | “Validating file…” then success message |
| 4 | Wait ~1 second | Connect screen closes; **Portfolio overview** opens |
| 5 | Use sidebar | Charts, scenarios, covenants, deal drill-down, AI chat |

No file picker is required for samples.

---

## 3. Sample inventory

| UI label | Static file (served by Vite) | Source workbook (repo) |
|----------|------------------------------|-------------------------|
| Sample 1 | `/samples/nexus-fund-ii.xlsx` | `database/portfolio_1_Nexus_Venture_Debt_Fund_II_LP 1.xlsx` |
| Sample 2 | `/samples/nexus-fund-iii.xlsx` | `database/portfolio_2_Nexus_Venture_Debt_Fund_III_LP 1.xlsx` |
| Sample 3 | `/samples/nexus-fund-iv.xlsx` | `database/portfolio_3_Nexus_Venture_Debt_Fund_IV_LP 1.xlsx` |
| Sample 4 | `/samples/nexus-portfolio-4.xlsx` | `database/portfolio_4.xlsx` |
| Sample 5 | `/samples/sample-portfolio.xlsx` | `database/sample-portfolio.xlsx` (copy of `venture_debt_portfolio.xlsx`) |

**Config (labels and paths):** `frontend/src/config/samplePortfolios.ts`  
**Static assets:** `frontend/public/samples/`  
**Canonical DB copies:** `database/` (including `sample-portfolio.xlsx` for API sample download)

---

## 4. End-to-end technical flow

```
┌─────────────┐     fetch /samples/*.xlsx      ┌──────────────┐
│   Browser   │ ─────────────────────────────► │ Vite (5173)  │
│ Connect UI  │     (static public files)      │ public/      │
└──────┬──────┘                                └──────────────┘
       │ build File(blob)
       │ POST /portfolio/upload (multipart)
       ▼
┌──────────────┐     proxy in dev              ┌──────────────┐
│  frontend    │ ─────────────────────────────►│ FastAPI      │
│  api.ts      │                               │ :8000        │
└──────┬───────┘                               └──────┬───────┘
       │                                              │
       │◄──────── JSON { deals[], filename } ─────────┘
       │         parse_upload_full()
       ▼
┌──────────────┐     POST /portfolio/summary   ┌──────────────┐
│  App.tsx     │ ─────────────────────────────►│ portfolio    │
│  state       │     IRR, AUM, deal IRRs       │ analytics    │
└──────────────┘                               └──────────────┘
```

### 4.1 Frontend — sample click

**File:** `frontend/src/components/ConnectScreen.tsx` — `loadSamplePortfolio()`

1. `fetch(sample.file)` — loads Excel from `public/samples/`.
2. `new File([blob], filename)` — treats the sample like a user-selected file.
3. `uploadPortfolio(file)` — `POST /portfolio/upload` with `FormData`.
4. On success: show deal count, then `onDealsLoaded(deals, filename)` after 900 ms.

Manual drag-and-drop / file picker uses the same `uploadPortfolio()` call via `handleFile()`.

### 4.2 Frontend — API client

**File:** `frontend/src/api.ts`

```http
POST /portfolio/upload
Content-Type: multipart/form-data
Body: file=<.xlsx>
```

Response: `{ deals: Deal[], filename: string }` (dates hydrated on the client).

### 4.3 Dev proxy

**File:** `frontend/vite.config.ts`

Requests to `/portfolio`, `/deal`, `/chat`, `/health`, etc. on port **5173** are proxied to the FastAPI server on **8000**, so the UI can use a relative API base URL.

### 4.4 Backend — parse and validate

**File:** `api/main.py` → `POST /portfolio/upload`  
**Logic:** `api/services/upload_service.py` → `parse_upload_full()`

- Accepts `.xlsx`, `.xls`, `.csv`, `.json` (max size: `MAX_UPLOAD_MB`, default 10).
- Validates **required columns** (with alias matching):

  | Required | Examples of accepted headers |
  |----------|------------------------------|
  | Borrower / Company | Borrower, Company, Deal Name |
  | Instrument Type | Instrument, Product, Facility Type |
  | Principal ($) | Principal, Loan Amount, Commitment |
  | Interest Rate | Rate, Coupon, Yield |
  | Tenure (Mo.) | Tenure, Tenor, Term |
  | Orig. Fee | Origination Fee, Upfront Fee |
  | EOT Fee | Exit Fee, End of Term Fee |
  | Covenant Status | Status, Health, Compliance |

- Returns normalized `Deal[]` for the React app.

### 4.5 App shell — after load

**File:** `frontend/src/App.tsx` — `handleDealsLoaded()`

- Stores `deals` and `sourceName`.
- Hides Connect screen; navigates to **Portfolio** view.
- Calls `POST /portfolio/summary` for backend-computed portfolio IRR and metrics.

---

## 5. Validation and test results

Automated checks: `scripts/test_sample_portfolios.py`  
Full report: `database/SAMPLE_PORTFOLIO_TEST_RESULTS.md`

**Summary (all samples passed on last run):**

| Sample | Deals | AUM | Portfolio IRR | Upload | Summary API | Deal metrics |
|--------|-------|-----|---------------|--------|-------------|--------------|
| Sample 1 | 5 | $7.40M | 18.04% | Pass | Pass | Pass |
| Sample 2 | 5 | $6.60M | 18.07% | Pass | Pass | Pass |
| Sample 3 | 5 | $7.25M | 18.18% | Pass | Pass | Pass |
| Sample 4 | 5 | $6.70M | 18.31% | Pass | Pass | Pass |
| Sample 5 | 6 | $50.50M | 17.48% | Pass | Pass | Pass |

Re-run tests:

```bash
cd private-credit-mcp
.venv\Scripts\activate
python -m uvicorn api.main:app --port 8000
# separate terminal:
python scripts/test_sample_portfolios.py
```

---

## 6. Runtime requirements

| Service | Command | URL |
|---------|---------|-----|
| API | `python -m uvicorn api.main:app --reload --port 8000` | http://localhost:8000 |
| UI | `cd frontend && npm run dev` | http://localhost:5173 |

Optional: `ANTHROPIC_API_KEY` in `.env` for AI chat (not required for sample load).  
`MONGODB_URI` is required for Mongo-backed agent tools only; **sample upload does not use MongoDB**.

---

## 7. Security and data handling

- Sample files are **static assets** bundled with the frontend; no third-party upload.
- Portfolio parsing runs on the **private FastAPI backend** (same as customer uploads).
- Parsed deals live in **browser memory** until refresh; they are not written to MongoDB by the upload endpoint alone.

---

## 8. Key source files (quick reference)

| Area | Path |
|------|------|
| Sample definitions | `frontend/src/config/samplePortfolios.ts` |
| Connect UI + load handler | `frontend/src/components/ConnectScreen.tsx` |
| Upload API client | `frontend/src/api.ts` |
| App state after load | `frontend/src/App.tsx` |
| Upload endpoint | `api/main.py` |
| Parse / validate | `api/services/upload_service.py` |
| Vite proxy | `frontend/vite.config.ts` |
| Test script | `scripts/test_sample_portfolios.py` |
| Test results | `database/SAMPLE_PORTFOLIO_TEST_RESULTS.md` |

---

## 9. Manual vs sample upload

| | Manual upload | Sample load |
|---|---------------|-------------|
| File source | User disk (file picker / drag-drop) | `frontend/public/samples/` via `fetch` |
| Backend endpoint | `POST /portfolio/upload` | Same |
| Validation | Same column rules | Same |
| Post-load behavior | Portfolio view + summary | Same |

The only difference is **how the `File` object is obtained**; downstream processing is identical.

---

## 10. Related documentation

- [CALCULATION_FLOW.md](./CALCULATION_FLOW.md) — IRR and portfolio math after load  
- [SAMPLE_PORTFOLIO_TEST_RESULTS.md](../database/SAMPLE_PORTFOLIO_TEST_RESULTS.md) — detailed pass/fail per file  
- [README.md](../README.md) — project setup
