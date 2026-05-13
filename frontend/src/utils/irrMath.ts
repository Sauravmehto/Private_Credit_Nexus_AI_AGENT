import type { Deal, IRRResult, AmortRow } from '../dealTypes'

/** Newton-Raphson IRR from monthly cash-flow array. Returns monthly rate or null. */
export function calcIRR(cfs: number[], guess = 0.01): number | null {
  let r = guess
  const tol = 1e-7
  for (let i = 0; i < 200; i++) {
    let npv = 0
    let dn = 0
    for (let j = 0; j < cfs.length; j++) {
      const p = Math.pow(1 + r, j)
      npv += cfs[j] / p
      if (j > 0) dn -= (j * cfs[j]) / ((1 + r) * p)
    }
    if (Math.abs(dn) < 1e-12) break
    const r2 = r - npv / dn
    if (Math.abs(r2 - r) < tol) { r = r2; break }
    r = r2
    if (r < -0.9999) r = 0.0001
  }
  return isFinite(r) ? r : null
}

/** Build monthly cash-flow array for a deal */
export function buildCashFlows(d: Deal): number[] {
  const P = d.principal
  const mr = d.rate / 12
  const mpik = (d.pik_rate || 0) / 12
  const cfs: number[] = [-P * (1 - (d.orig_fee || 0))]
  let bal = P
  const mp = d.amort > 0 ? P / d.amort : 0
  for (let m = 1; m <= d.tenure; m++) {
    const interest = bal * mr
    const pik = bal * mpik
    let prin = m === d.tenure ? bal + pik : m <= d.io ? 0 : mp
    const eot = m === d.tenure ? P * (d.eot_fee || 0) : 0
    cfs.push(interest + prin + eot)
    bal = m === d.tenure ? 0 : bal - prin + pik
    if (bal < 0) bal = 0
  }
  return cfs
}

/** Compute full IRR breakdown for a single deal */
export function dealIRR(d: Deal): IRRResult | null {
  if (!d || !d.principal || !d.rate) return null
  const cfs = buildCashFlows(d)
  const mIRR = calcIRR(cfs)
  if (mIRR === null) return null
  const annIRR = Math.pow(1 + mIRR, 12) - 1

  const P = d.principal
  let bal = P
  const mp = d.amort > 0 ? P / d.amort : 0
  let ti = 0
  let futureInflows = 0
  for (let i = 1; i <= d.tenure; i++) {
    const interest = bal * (d.rate / 12)
    const pik = bal * ((d.pik_rate || 0) / 12)
    const pr = i === d.tenure ? bal + pik : i <= d.io ? 0 : mp
    const eot = i === d.tenure ? P * (d.eot_fee || 0) : 0
    futureInflows += interest + pr + eot
    if (i === d.tenure) { bal = 0 } else { bal = bal - pr + pik }
    if (bal < 0) bal = 0
  }

  const of_ = P * (d.orig_fee || 0)
  const ef_ = P * (d.eot_fee || 0)

  ti = Math.max(0, futureInflows - P - ef_)

  return {
    mIRR,
    annIRR,
    totalInterest: ti,
    origFeeAmt: of_,
    eotFeeAmt: ef_,
    totalIncome: ti + of_ + ef_,
    MOIC: (of_ + futureInflows) / P,
    couponBps: Math.round(d.rate * 10000),
    origBps: Math.round(((d.orig_fee || 0) / d.tenure * 12) * 10000),
    eotBps: Math.round(((d.eot_fee || 0) / d.tenure * 12) * 10000),
    pikBps: Math.round((d.pik_rate || 0) * 10000),
  }
}

/** Weighted-average portfolio IRR */
export function portfolioIRR(deals: Deal[]): number | null {
  if (!deals.length) return null
  const tot = deals.reduce((s, d) => s + (d.principal || 0), 0)
  if (!tot) return null
  let wt = 0
  deals.forEach((d) => {
    const r = dealIRR(d)
    if (r && d.principal) wt += r.annIRR * (d.principal / tot)
  })
  return wt
}

/** Build monthly amortization schedule rows */
export function buildAmortSchedule(d: Deal): AmortRow[] {
  const TODAY = new Date(); TODAY.setHours(0, 0, 0, 0)
  const start = d.origination || new Date()
  const rows: AmortRow[] = []
  let bal = d.principal
  const P = d.principal
  const mr = d.rate / 12
  const mpik = (d.pik_rate || 0) / 12
  const mp = d.amort > 0 ? P / d.amort : 0

  for (let m = 1; m <= d.tenure; m++) {
    const pd = new Date(start)
    pd.setMonth(pd.getMonth() + m)
    pd.setHours(0, 0, 0, 0)

    const interest = bal * mr
    const pik = bal * mpik
    let prin = m === d.tenure ? bal + pik : m <= d.io ? 0 : mp
    const eot = m === d.tenure ? P * (d.eot_fee || 0) : 0
    const total = interest + prin + eot
    let cb = m === d.tenure ? 0 : bal - prin + pik
    if (cb < 0.01) cb = 0

    const status: AmortRow['status'] =
      pd.getTime() === TODAY.getTime() ? 'today'
      : pd < TODAY ? 'paid'
      : 'pending'

    rows.push({
      m,
      date: pd,
      phase: m <= d.io ? 'IO' : m === d.tenure ? 'Amort (Final)' : 'Amort',
      openBal: bal,
      interest,
      prin,
      eot,
      total,
      closeBal: cb,
      status,
    })
    bal = cb
  }
  return rows
}
