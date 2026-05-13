"""FastAPI app for chat/upload endpoints with normalized errors."""

from __future__ import annotations

import logging
import os
import time
import uuid

from pathlib import Path

from dotenv import load_dotenv

# Repo root (parent of `api/`) so `.env` loads even when cwd is not the project directory.
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from api.schemas import (
    AmortRequest,
    AmortRowResponse,
    ChatRequest,
    ChatResponse,
    CovenantRequest,
    CovenantResult,
    DealMetricsRequest,
    DealMetricsResponse,
    ErrorInfo,
    ErrorResponse,
    FileUploadResponse,
    IRRCalcRequest,
    PortfolioAISummaryRequest,
    PortfolioAISummaryResponse,
    PortfolioSummaryRequest,
    PortfolioSummaryResponse,
    PortfolioUploadResponse,
    ScenarioRequest,
    ScenarioResult,
)
from api.request_context import reset_request_id, set_request_id
from api.services.chat_service import run_chat
from api.services.portfolio_ai_service import generate_portfolio_ai_summary
from api.services.upload_service import parse_upload, parse_upload_full
from api.services import portfolio_service as ps

_log_level_name = os.getenv("LOG_LEVEL", "INFO").upper()
_log_level = getattr(logging, _log_level_name, logging.INFO)
logging.basicConfig(level=_log_level)
logger = logging.getLogger("private-credit-api")
logger.setLevel(_log_level)

app = FastAPI(title="Private Credit Chat API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.options("/{path:path}")
def options_handler(path: str) -> dict[str, str]:
    return {"status": "ok"}


def _error_response(
    *,
    request: Request,
    status_code: int,
    code: str,
    message: str,
    details: object | None = None,
) -> JSONResponse:
    payload = ErrorResponse(
        error=ErrorInfo(
            code=code,
            message=message,
            details=details,
            request_id=getattr(request.state, "request_id", None),
        )
    )
    return JSONResponse(status_code=status_code, content=payload.model_dump())


@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    request.state.request_id = request_id
    request_id_token = set_request_id(request_id)
    started = time.monotonic()
    try:
        response = await call_next(request)
        elapsed_ms = int((time.monotonic() - started) * 1000)
        response.headers["x-request-id"] = request_id
        logger.info(
            "request_complete method=%s path=%s status=%s request_id=%s duration_ms=%s",
            request.method,
            request.url.path,
            response.status_code,
            request_id,
            elapsed_ms,
        )
        return response
    finally:
        reset_request_id(request_id_token)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    code = "http_error"
    if exc.status_code == 422:
        code = "validation_error"
    elif exc.status_code == 503:
        code = "service_unavailable"
    elif exc.status_code == 413:
        code = "payload_too_large"
    return _error_response(
        request=request,
        status_code=exc.status_code,
        code=code,
        message=str(exc.detail),
        details=exc.detail if isinstance(exc.detail, (dict, list)) else None,
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled_exception request_id=%s", getattr(request.state, "request_id", "unknown"))
    return _error_response(
        request=request,
        status_code=500,
        code="internal_error",
        message="Internal server error.",
    )


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest) -> ChatResponse:
    return await run_chat(request.prompt)


@app.post("/upload", response_model=FileUploadResponse)
async def upload_file(file: UploadFile = File(...)) -> FileUploadResponse:
    max_upload_mb = float(os.getenv("MAX_UPLOAD_MB", "10"))
    max_upload_bytes = int(max_upload_mb * 1024 * 1024)
    content_length = file.size or 0
    if content_length > max_upload_bytes:
        raise HTTPException(status_code=413, detail=f"File too large. Max upload size is {max_upload_mb:.0f}MB.")
    return await parse_upload(file)


@app.get("/health")
def health() -> dict[str, str]:
    payload: dict[str, str] = {"status": "ok", "service": "private-credit-chat-api"}
    if not os.getenv("MONGODB_URI", "").strip():
        payload["mongodb"] = "skipped"
    else:
        try:
            from private_credit_mcp.data import db as db_mod

            db_mod.test_connection()
            payload["mongodb"] = "ok"
        except Exception as exc:  # noqa: BLE001
            payload["mongodb"] = "error"
            payload["mongodb_error"] = type(exc).__name__
    return payload


@app.get("/sample/venture_debt_portfolio.xlsx")
def download_sample_portfolio() -> FileResponse:
    sample_path = Path(__file__).resolve().parents[1] / "database" / "venture_debt_portfolio.xlsx"
    if not sample_path.exists():
        raise HTTPException(status_code=404, detail="Sample file not found.")
    return FileResponse(
        path=str(sample_path),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename="venture_debt_portfolio.xlsx",
    )


# ---------------------------------------------------------------------------
# AI-backend workflow routes
# ---------------------------------------------------------------------------

@app.post("/portfolio/upload", response_model=PortfolioUploadResponse)
async def portfolio_upload(file: UploadFile = File(...)) -> PortfolioUploadResponse:
    """Parse an uploaded Excel/CSV/JSON file and return normalized deals[]."""
    max_upload_mb = float(os.getenv("MAX_UPLOAD_MB", "10"))
    max_upload_bytes = int(max_upload_mb * 1024 * 1024)
    if (file.size or 0) > max_upload_bytes:
        raise HTTPException(status_code=413, detail=f"File too large. Max {max_upload_mb:.0f}MB.")
    return await parse_upload_full(file)


@app.post("/portfolio/summary", response_model=PortfolioSummaryResponse)
def portfolio_summary(req: PortfolioSummaryRequest) -> PortfolioSummaryResponse:
    """Compute portfolio-level IRR, AUM, health metrics for uploaded deals."""
    deals = [d.model_dump() for d in req.deals]
    result = ps.analyze_portfolio(deals)
    return PortfolioSummaryResponse(**result)


@app.post("/portfolio/ai-summary", response_model=PortfolioAISummaryResponse)
async def portfolio_ai_summary(req: PortfolioAISummaryRequest) -> PortfolioAISummaryResponse:
    """Generate Anthropic narrative commentary over deterministic portfolio metrics."""
    deals = [d.model_dump() for d in req.deals]
    result = await generate_portfolio_ai_summary(deals)
    return PortfolioAISummaryResponse(**result)


@app.post("/deal/metrics", response_model=DealMetricsResponse)
def deal_metrics(req: DealMetricsRequest) -> DealMetricsResponse:
    """Compute IRR, MOIC and income breakdown for a single deal."""
    result = ps.analyze_deal(req.deal.model_dump())
    return DealMetricsResponse(**result)


@app.post("/deal/amortization", response_model=list[AmortRowResponse])
def deal_amortization(req: AmortRequest) -> list[AmortRowResponse]:
    """Return full monthly amortization schedule for a deal."""
    rows = ps.get_amortization(req.deal.model_dump())
    return [AmortRowResponse(**r) for r in rows]


@app.post("/deal/scenarios", response_model=list[ScenarioResult])
def deal_scenarios(req: ScenarioRequest) -> list[ScenarioResult]:
    """Return 8 preset + optional custom scenario IRRs for a deal."""
    results = ps.analyze_scenarios(req.deal.model_dump(), req.custom_params)
    return [ScenarioResult(**r) for r in results]


@app.post("/deal/covenants", response_model=list[CovenantResult])
def deal_covenants(req: CovenantRequest) -> list[CovenantResult]:
    """Return covenant status for all deals."""
    deals = [d.model_dump() for d in req.deals]
    results = ps.analyze_covenants(deals)
    return [CovenantResult(**r) for r in results]


@app.post("/irr/calculate", response_model=DealMetricsResponse)
def irr_calculate(req: IRRCalcRequest) -> DealMetricsResponse:
    """Compute IRR metrics for explicit parameters (IRR modal calculator)."""
    result = ps.calculate_custom_irr(req.model_dump())
    return DealMetricsResponse(**result)
