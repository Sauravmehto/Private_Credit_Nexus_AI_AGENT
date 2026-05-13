export type DealStatus = 'compliant' | 'monitoring' | 'breach risk'

export interface VerifiedResult {
  deal_id: string
  annIRR: number
  moic: number
  totalIncome: number
  corrected: boolean
}

export type VerifyStatus = 'idle' | 'verifying' | 'done' | 'failed'

export interface Deal {
  id: string
  deal_id: string
  name: string
  instrument_type: string
  principal: number
  outstanding: number
  rate: number
  io: number
  amort: number
  tenure: number
  orig_fee: number
  eot_fee: number
  pik_rate: number
  warrant: string
  status: DealStatus
  sector: string
  stage: string
  maturity: string
  origination: Date
  interest_type: string
}

export interface IRRResult {
  mIRR: number
  annIRR: number
  totalInterest: number
  origFeeAmt: number
  eotFeeAmt: number
  totalIncome: number
  MOIC: number
  couponBps: number
  origBps: number
  eotBps: number
  pikBps: number
}

export interface AmortRow {
  m: number
  date: Date
  phase: string
  openBal: number
  interest: number
  prin: number
  eot: number
  total: number
  closeBal: number
  status: 'paid' | 'today' | 'pending'
}

export interface ScenarioInput {
  id: string
  label: string
  badge: 'base' | 'best' | 'worst' | 'cust'
  rate: number
  tenure: number
  io: number
  origFee: number
  eotFee: number
  pik: number
}

export type AppView = 'portfolio' | 'charts' | 'scenario' | 'covenant' | 'deal'

export interface InstrumentConfig {
  l: string
  i: string
  tools: string[]
}

export const INSTRUMENT_MAP: Record<string, InstrumentConfig> = {
  'term loan':          { l: 'Term Loan',   i: '💼', tools: ['irr','amort','restr','impact','cov'] },
  'senior secured tl':  { l: 'Secured TL',  i: '🏦', tools: ['irr','amort','restr','impact','cov'] },
  'bridge loan':        { l: 'Bridge Loan', i: '🌉', tools: ['irr','restr','impact','cov'] },
  'convertible note':   { l: 'Conv. Note',  i: '🔄', tools: ['irr','restr','impact'] },
  'revenue-based note': { l: 'Rev. Note',   i: '📈', tools: ['irr','restr','impact'] },
  'warrant':            { l: 'Warrant',     i: '⚡', tools: ['irr'] },
  'note':               { l: 'Note',        i: '📝', tools: ['irr','restr','impact','cov'] },
}

export function getInstrumentConfig(deal: Deal): InstrumentConfig {
  const key = (deal.instrument_type || '').toLowerCase().trim()
  return INSTRUMENT_MAP[key] ?? INSTRUMENT_MAP['term loan']
}

export const STATUS_DOT: Record<DealStatus, string> = {
  compliant:     'bg-emerald-400',
  monitoring:    'bg-amber-400',
  'breach risk': 'bg-rose-400',
}

export const STATUS_BADGE: Record<DealStatus, string> = {
  compliant:     'bg-emerald-100 text-emerald-800',
  monitoring:    'bg-amber-100 text-amber-800',
  'breach risk': 'bg-rose-100 text-rose-800',
}

export const STATUS_LABEL: Record<DealStatus, string> = {
  compliant:     'Compliant',
  monitoring:    'Monitoring',
  'breach risk': 'Breach Risk',
}
