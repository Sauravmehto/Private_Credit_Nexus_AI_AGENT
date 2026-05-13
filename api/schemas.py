from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class ErrorInfo(BaseModel):
    code: str
    message: str
    details: Any | None = None
    request_id: str | None = None


class ErrorResponse(BaseModel):
    error: ErrorInfo


class FileUploadResponse(BaseModel):
    filename: str
    row_count: int
    columns: list[str]
    sheet_name: str | None
    preview: list[dict[str, Any]]


class ChatRequest(BaseModel):
    prompt: str


class ToolCallRecord(BaseModel):
    tool: str
    input: dict[str, Any]
    output: Any
    duration_ms: int


class ChatResponse(BaseModel):
    answer: str
    tool_calls: list[ToolCallRecord]


# ---------------------------------------------------------------------------
# New AI-backend workflow schemas
# ---------------------------------------------------------------------------

class DealPayload(BaseModel):
    """Mirrors the frontend Deal interface — fees as fractions (0.02 = 2%)."""
    id: str = ""
    deal_id: str = ""
    name: str = ""
    instrument_type: str = "term loan"
    principal: float = 0.0
    outstanding: float = 0.0
    rate: float = 0.0
    io: int = 0
    amort: int = 0
    tenure: int = 36
    orig_fee: float = 0.02
    eot_fee: float = 0.025
    pik_rate: float = 0.0
    warrant: str = ""
    status: str = "compliant"
    sector: str = ""
    stage: str = ""
    maturity: str = ""
    origination: str | None = None
    interest_type: str = "Fixed"


# ── Requests ────────────────────────────────────────────────────────────────

class PortfolioSummaryRequest(BaseModel):
    deals: list[DealPayload]


class PortfolioAISummaryRequest(BaseModel):
    deals: list[DealPayload]


class DealMetricsRequest(BaseModel):
    deal: DealPayload


class AmortRequest(BaseModel):
    deal: DealPayload


class ScenarioRequest(BaseModel):
    deal: DealPayload
    custom_params: dict[str, Any] | None = None


class CovenantRequest(BaseModel):
    deals: list[DealPayload]


class IRRCalcRequest(BaseModel):
    principal: float
    rate: float
    io_months: int = 0
    amort_months: int = 0
    orig_fee: float = 0.02
    eot_fee: float = 0.025
    pik_rate: float = 0.0
    warrant_fmv: float = 0.0


# ── Responses ───────────────────────────────────────────────────────────────

class PortfolioUploadResponse(BaseModel):
    deals: list[dict[str, Any]]
    filename: str
    row_count: int


class DealIRRSummary(BaseModel):
    deal_id: str
    name: str = ""
    irr: float = 0.0
    ann_irr: float
    moic: float
    total_income: float
    coupon_bps: int
    orig_bps: int
    eot_bps: int
    pik_bps: int


class PortfolioSummaryResponse(BaseModel):
    aum: float
    deal_count: int
    port_irr: float
    wtd_rate: float
    breach: int
    monitoring: int
    compliant: int
    deal_irrs: list[DealIRRSummary]


class PortfolioAISummaryResponse(BaseModel):
    summary: str
    metrics: PortfolioSummaryResponse
    tool_calls: list[ToolCallRecord] = []


class DealMetricsResponse(BaseModel):
    ann_irr: float
    m_irr: float
    moic: float
    total_income: float
    total_interest: float
    orig_fee_amt: float
    eot_fee_amt: float
    coupon_bps: int
    orig_bps: int
    eot_bps: int
    pik_bps: int


class AmortRowResponse(BaseModel):
    m: int
    date: str
    phase: str
    open_bal: float
    interest: float
    prin: float
    eot: float
    total: float
    close_bal: float
    status: str


class ScenarioResult(BaseModel):
    id: str
    label: str
    badge: str
    rate: float
    tenure: int
    io: int
    orig_fee: float
    eot_fee: float
    pik: float
    ann_irr: float
    delta: float


class CovenantEntry(BaseModel):
    name: str
    threshold: str
    actual: str
    pct: float
    status: str


class CovenantResult(BaseModel):
    deal_id: str
    covenants: list[CovenantEntry]
