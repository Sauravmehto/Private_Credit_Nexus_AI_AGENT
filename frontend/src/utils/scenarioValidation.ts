import type { Deal } from '../dealTypes'
import type { AmortRow } from '../dealTypes'
import { buildAmortSchedule } from './irrMath'
import type { AmortRowResponse } from '../types'

export interface ScenarioDraft {
  ratePct: string
  io: string
  amort: string
  tenure: string
}

export type ScenarioField = keyof ScenarioDraft

const MIN_RATE_PCT = 0.5
const MAX_RATE_PCT = 50
const MAX_MONTHS = 360

export function draftFromDeal(deal: Deal): ScenarioDraft {
  return {
    ratePct: (deal.rate * 100).toFixed(2),
    io: String(deal.io),
    amort: String(deal.amort),
    tenure: String(deal.tenure),
  }
}

export function applyDraftChange(draft: ScenarioDraft, field: ScenarioField, raw: string): ScenarioDraft {
  const next: ScenarioDraft = { ...draft, [field]: raw }
  const io = parseInt(next.io, 10)
  const amort = parseInt(next.amort, 10)
  const tenure = parseInt(next.tenure, 10)

  if (field === 'io' || field === 'amort') {
    if (!Number.isNaN(io) && !Number.isNaN(amort)) {
      next.tenure = String(io + amort)
    }
  } else if (field === 'tenure') {
    if (!Number.isNaN(tenure) && !Number.isNaN(io)) {
      next.amort = String(Math.max(0, tenure - io))
    }
  }
  return next
}

export function validateScenarioDraft(draft: ScenarioDraft): {
  valid: boolean
  errors: Partial<Record<ScenarioField, string>>
} {
  const errors: Partial<Record<ScenarioField, string>> = {}

  const ratePct = parseFloat(draft.ratePct)
  if (Number.isNaN(ratePct)) {
    errors.ratePct = 'Enter a valid rate'
  } else if (ratePct < MIN_RATE_PCT || ratePct > MAX_RATE_PCT) {
    errors.ratePct = `Rate must be ${MIN_RATE_PCT}%–${MAX_RATE_PCT}%`
  }

  const io = parseInt(draft.io, 10)
  if (Number.isNaN(io) || draft.io.trim() === '') {
    errors.io = 'Enter IO months'
  } else if (io < 0 || io > MAX_MONTHS) {
    errors.io = `IO must be 0–${MAX_MONTHS}`
  }

  const amort = parseInt(draft.amort, 10)
  if (Number.isNaN(amort) || draft.amort.trim() === '') {
    errors.amort = 'Enter amort months'
  } else if (amort < 0 || amort > MAX_MONTHS) {
    errors.amort = `Amort must be 0–${MAX_MONTHS}`
  }

  const tenure = parseInt(draft.tenure, 10)
  if (Number.isNaN(tenure) || draft.tenure.trim() === '') {
    errors.tenure = 'Enter tenure'
  } else if (tenure < 1 || tenure > MAX_MONTHS) {
    errors.tenure = `Tenure must be 1–${MAX_MONTHS}`
  }

  if (
    !errors.io &&
    !errors.amort &&
    !errors.tenure &&
    !Number.isNaN(io) &&
    !Number.isNaN(amort) &&
    !Number.isNaN(tenure) &&
    tenure !== io + amort
  ) {
    errors.tenure = 'Tenure must equal IO + Amort months'
  }

  return { valid: Object.keys(errors).length === 0, errors }
}

export function buildScenarioDeal(base: Deal, draft: ScenarioDraft): Deal {
  const { errors, valid } = validateScenarioDraft(draft)
  if (!valid) {
    throw new Error(Object.values(errors).find(Boolean) ?? 'Invalid scenario')
  }
  const ratePct = parseFloat(draft.ratePct)
  const io = parseInt(draft.io, 10)
  const amort = parseInt(draft.amort, 10)
  const tenure = parseInt(draft.tenure, 10)
  return {
    ...base,
    rate: ratePct / 100,
    io,
    amort,
    tenure,
  }
}

export function scheduleBadgeLabel(io: number, amort: number): string {
  return amort > 0 ? `IO ${io}m + Amort ${amort}m` : 'Bullet'
}

export function browserAmortToApiRows(deal: Deal): AmortRowResponse[] {
  return buildAmortSchedule(deal).map((r: AmortRow) => ({
    m: r.m,
    date: r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date),
    phase: r.phase,
    open_bal: r.openBal,
    interest: r.interest,
    prin: r.prin,
    eot: r.eot,
    total: r.total,
    close_bal: r.closeBal,
    status: r.status,
  }))
}
