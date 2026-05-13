export interface ToolCall {
  tool: string
  input: Record<string, unknown>
  output: unknown
  duration_ms: number
}

export interface ChatResponse {
  answer: string
  tool_calls: ToolCall[]
}

export interface ApiError {
  code: string
  message: string
  details?: unknown
  request_id?: string | null
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  tool_calls?: ToolCall[]
}

// ---------------------------------------------------------------------------
// AI-backend workflow types
// ---------------------------------------------------------------------------

export interface PortfolioUploadResponse {
  deals: import('./dealTypes').Deal[]
  filename: string
  row_count: number
}

export interface DealIRRSummary {
  deal_id: string
  ann_irr: number
  moic: number
  total_income: number
  coupon_bps: number
  orig_bps: number
  eot_bps: number
  pik_bps: number
}

export interface PortfolioSummaryResponse {
  aum: number
  deal_count: number
  port_irr: number
  wtd_rate: number
  breach: number
  monitoring: number
  compliant: number
  deal_irrs: DealIRRSummary[]
}

export interface PortfolioAISummaryResponse {
  summary: string
  metrics: PortfolioSummaryResponse
  tool_calls: ToolCall[]
}

export interface DealMetricsResponse {
  ann_irr: number
  m_irr: number
  moic: number
  total_income: number
  total_interest: number
  orig_fee_amt: number
  eot_fee_amt: number
  coupon_bps: number
  orig_bps: number
  eot_bps: number
  pik_bps: number
}

export interface AmortRowResponse {
  m: number
  date: string
  phase: string
  open_bal: number
  interest: number
  prin: number
  eot: number
  total: number
  close_bal: number
  status: 'paid' | 'today' | 'pending'
}

export interface ScenarioResult {
  id: string
  label: string
  badge: 'base' | 'best' | 'worst' | 'cust'
  rate: number
  tenure: number
  io: number
  orig_fee: number
  eot_fee: number
  pik: number
  ann_irr: number
  delta: number
}

export interface CovenantEntry {
  name: string
  threshold: string
  actual: string
  pct: number
  status: 'compliant' | 'monitoring' | 'breach'
}

export interface CovenantResult {
  deal_id: string
  covenants: CovenantEntry[]
}

export interface IRRCalcParams {
  principal: number
  rate: number
  io_months: number
  amort_months: number
  orig_fee: number
  eot_fee: number
  pik_rate?: number
  warrant_fmv?: number
}

export interface ScenarioParams {
  rate?: number
  tenure?: number
  io?: number
  orig_fee?: number
  eot_fee?: number
  pik_rate?: number
}
