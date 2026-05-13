# Private Credit Analyst

Private credit analytics powered by **FastAPI** and **LangChain**: portfolio queries (MongoDB), IRR / restructuring math, and document helpers exposed as **LangChain tools** behind **`POST /chat`** with resilient LLM fallback.

- **Architecture:** [PRIVATE_CREDIT_MCP_EXPLAINED.md](PRIVATE_CREDIT_MCP_EXPLAINED.md)  
- **Mongo setup:** [database/MONGODB_SETUP.md](database/MONGODB_SETUP.md)  
- **Smoke prompts:** [TOOL_SMOKE_PROMPTS.md](TOOL_SMOKE_PROMPTS.md)  
- **Seed data:** [`private_credit_mcp/data/seed_deals.json`](private_credit_mcp/data/seed_deals.json) (CSV under `database/` is illustrative only — see Mongo docs).

## Quick start

```bash
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # macOS/Linux

pip install -e ".[dev]"
copy .env.example .env     # set MONGODB_URI and at least one provider key
private-credit-seed        # optional: load sample deals
python -m pytest tests/ -v
```

### API + Vite UI (local dev)

From the repo root (`private-credit-mcp`):

**Terminal 1 — API (port 8000)**

```bash
python -m uvicorn api.main:app --reload --port 8000
```

**Terminal 2 — frontend (port 5173)**

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. Vite proxies `/chat` and `/health` to `http://localhost:8000` ([`frontend/vite.config.ts`](frontend/vite.config.ts)).

**Secrets (`.env` only, never commit)**

- `ANTHROPIC_API_KEY` — required for `POST /chat`
- `OPENAI_API_KEY`, `GEMINI_API_KEY` (or `Gemin_API_Key`), `GROQ_API_KEY` — optional fallbacks
- Provider order: Anthropic -> OpenAI -> Gemini -> Groq
- Cheap defaults: `claude-sonnet-4-5-20250929`, `gpt-4o-mini`, `gemini-1.5-flash`, `llama-3.1-8b-instant`
- `MONGODB_URI` — required for portfolio/deal tools used by the agent

```bash
curl http://localhost:8000/health
```

If an API key was ever pasted into chat or commits, **rotate it** in the relevant provider console.

## GitHub checklist

- Confirm **`.env` is not tracked** (listed in `.gitignore`).
- Prefer **Python 3.11–3.13** where possible; 3.14 works with pytest filters in `pyproject.toml`.

## Render deployment

1. Create **MongoDB Atlas** (or compatible) and set **`MONGODB_URI`**. The database name is taken from the URI path (e.g. `...mongodb.net/private_credit?...`).
2. Set provider key(s) for chat: **`ANTHROPIC_API_KEY`**, and optionally **`OPENAI_API_KEY`**, **`GEMINI_API_KEY`** (or `Gemin_API_Key`), **`GROQ_API_KEY`**.
3. Use **`render.yaml`** as a Blueprint, or create a **Web Service**:
   - **Build:** `pip install --upgrade pip && pip install .`
   - **Start:** `python -m uvicorn api.main:app --host 0.0.0.0 --port $PORT`
   - **Health check:** `/health` (includes optional **`mongodb`** status).
4. Serve the **frontend** separately (static host or another Render static site) **or** build and upload assets — set **`VITE_API_URL`** to your API origin so the UI calls the correct host.
5. Set **`CORS_ALLOW_ORIGINS`** on the API to your frontend origin(s), comma-separated.

## Security

There is **no authentication** on the API by default. Protect **`POST /chat`** before exposing it publicly (gateway auth, VPN, or private network).
