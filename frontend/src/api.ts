import type { Deal } from './dealTypes'
import type {
  AmortRowResponse,
  ApiError,
  ChatResponse,
  CovenantResult,
  DealMetricsResponse,
  IRRCalcParams,
  PortfolioAISummaryResponse,
  PortfolioSummaryResponse,
  PortfolioUploadResponse,
  ScenarioParams,
  ScenarioResult,
} from './types'

const API_BASE = import.meta.env.VITE_API_URL ?? ''

function isApiErrorEnvelope(data: unknown): data is { error: ApiError } {
  return typeof data === 'object' && data !== null && 'error' in data
}

async function parseError(res: Response): Promise<Error> {
  const requestId = res.headers.get('x-request-id')
  const raw = await res.text()

  try {
    const parsed: unknown = JSON.parse(raw)
    if (isApiErrorEnvelope(parsed)) {
      const err = parsed.error
      const msg = requestId ? `${err.message} (request: ${requestId})` : err.message
      return new Error(msg)
    }
    if (typeof parsed === 'object' && parsed !== null && 'detail' in parsed) {
      const detail = (parsed as { detail: unknown }).detail
      if (typeof detail === 'object' && detail !== null && 'message' in detail) {
        const detailObj = detail as { message: string; missing_columns?: string[] }
        const msg = requestId ? `${detailObj.message} (request: ${requestId})` : detailObj.message
        const err = new Error(msg) as Error & { missingColumns?: string[] }
        err.missingColumns = detailObj.missing_columns
        return err
      }
      const msg = requestId ? `${String(detail)} (request: ${requestId})` : String(detail)
      return new Error(msg)
    }
  } catch {
    // non-json error body
  }

  const fallback = raw || `HTTP ${res.status}`
  const msg = requestId ? `${fallback} (request: ${requestId})` : fallback
  return new Error(msg)
}

/** Convert origination strings to Date objects in a deals array from the backend. */
function hydrateDates(deals: Deal[]): Deal[] {
  return deals.map((d) => ({
    ...d,
    origination: d.origination
      ? (d.origination instanceof Date ? d.origination : new Date(String(d.origination)))
      : new Date(),
  }))
}

export async function sendMessage(prompt: string, signal?: AbortSignal): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
    signal,
  })
  if (!res.ok) throw await parseError(res)
  return res.json() as Promise<ChatResponse>
}

export async function fetchHealth(signal?: AbortSignal): Promise<Record<string, string>> {
  const res = await fetch(`${API_BASE}/health`, { signal })
  if (!res.ok) throw await parseError(res)
  return res.json() as Promise<Record<string, string>>
}

// ---------------------------------------------------------------------------
// AI-backend workflow API functions
// ---------------------------------------------------------------------------

export async function uploadPortfolio(
  file: File,
  signal?: AbortSignal,
): Promise<PortfolioUploadResponse> {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${API_BASE}/portfolio/upload`, { method: 'POST', body: form, signal })
  if (!res.ok) throw await parseError(res)
  const data = (await res.json()) as PortfolioUploadResponse
  return { ...data, deals: hydrateDates(data.deals) }
}

export async function getPortfolioSummary(
  deals: Deal[],
  signal?: AbortSignal,
): Promise<PortfolioSummaryResponse> {
  const res = await fetch(`${API_BASE}/portfolio/summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deals }),
    signal,
  })
  if (!res.ok) throw await parseError(res)
  return res.json() as Promise<PortfolioSummaryResponse>
}

export async function getPortfolioAISummary(
  deals: Deal[],
  signal?: AbortSignal,
): Promise<PortfolioAISummaryResponse> {
  const res = await fetch(`${API_BASE}/portfolio/ai-summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deals }),
    signal,
  })
  if (!res.ok) throw await parseError(res)
  return res.json() as Promise<PortfolioAISummaryResponse>
}

export async function getDealMetrics(
  deal: Deal,
  signal?: AbortSignal,
): Promise<DealMetricsResponse> {
  const res = await fetch(`${API_BASE}/deal/metrics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deal }),
    signal,
  })
  if (!res.ok) throw await parseError(res)
  return res.json() as Promise<DealMetricsResponse>
}

export async function getAmortization(
  deal: Deal,
  signal?: AbortSignal,
): Promise<AmortRowResponse[]> {
  const res = await fetch(`${API_BASE}/deal/amortization`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deal }),
    signal,
  })
  if (!res.ok) throw await parseError(res)
  return res.json() as Promise<AmortRowResponse[]>
}

export async function getScenarios(
  deal: Deal,
  customParams?: ScenarioParams,
  signal?: AbortSignal,
): Promise<ScenarioResult[]> {
  const res = await fetch(`${API_BASE}/deal/scenarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deal, custom_params: customParams ?? null }),
    signal,
  })
  if (!res.ok) throw await parseError(res)
  return res.json() as Promise<ScenarioResult[]>
}

export async function getCovenants(
  deals: Deal[],
  signal?: AbortSignal,
): Promise<CovenantResult[]> {
  const res = await fetch(`${API_BASE}/deal/covenants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deals }),
    signal,
  })
  if (!res.ok) throw await parseError(res)
  return res.json() as Promise<CovenantResult[]>
}

export async function calculateIRR(
  params: IRRCalcParams,
  signal?: AbortSignal,
): Promise<DealMetricsResponse> {
  const res = await fetch(`${API_BASE}/irr/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal,
  })
  if (!res.ok) throw await parseError(res)
  return res.json() as Promise<DealMetricsResponse>
}
