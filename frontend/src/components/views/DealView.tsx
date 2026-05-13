import { useEffect, useRef, useState } from 'react'
import type { Deal } from '../../dealTypes'
import { getInstrumentConfig, STATUS_BADGE, STATUS_LABEL } from '../../dealTypes'
import { dealIRR, buildAmortSchedule } from '../../utils/irrMath'
import { fD, fP, fPct1, fDate } from '../../utils/formatters'
import { getDealMetrics, getAmortization } from '../../api'
import type { DealMetricsResponse, AmortRowResponse, PortfolioSummaryResponse } from '../../types'

interface Props {
  deal: Deal
  backendSummary: PortfolioSummaryResponse | null
  onIrrClick: (deal: Deal) => void
  onTool: (tool: string, prompt: string) => void
}

interface ParamItem {
  label: string
  value: string
  cls?: string
  clickable?: boolean
  onClick?: () => void
}

export function DealView({ deal: d, backendSummary, onIrrClick, onTool }: Props) {
  const cfg = getInstrumentConfig(d)
  const browserIRR = dealIRR(d)
  const bdg = STATUS_BADGE[d.status] ?? ''
  const stxt = STATUS_LABEL[d.status] ?? d.status

  // Backend metrics state
  const [metrics, setMetrics] = useState<DealMetricsResponse | null>(null)
  const [amortRows, setAmortRows] = useState<AmortRowResponse[] | null>(null)

  useEffect(() => {
    const ctrl = new AbortController()
    setMetrics(null)
    setAmortRows(null)
    getDealMetrics(d, ctrl.signal).then(setMetrics).catch(() => {/* fallback to browser */})
    getAmortization(d, ctrl.signal).then(setAmortRows).catch(() => {/* fallback to browser */})
    return () => ctrl.abort()
  }, [d.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve IRR: backend is authoritative, browser is instant fallback
  const backendDealIRR = backendSummary?.deal_irrs.find(di => di.deal_id === d.id)
  const annIRR = metrics?.ann_irr ?? backendDealIRR?.ann_irr ?? browserIRR?.annIRR ?? 0
  const moicVal = metrics?.moic ?? backendDealIRR?.moic ?? browserIRR?.MOIC ?? 0
  const irrStr = annIRR ? fPct1(annIRR) : 'N/A'

  // Amortization schedule: backend rows or browser fallback
  const browserAmort = buildAmortSchedule(d)
  const scheduleRows = amortRows ?? browserAmort.map(r => ({
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

  const latestBalanceRow = [...scheduleRows]
    .reverse()
    .find((r) => r.status === 'today' || r.status === 'paid')
  const calculatedOutstanding = latestBalanceRow?.close_bal ?? d.outstanding ?? d.principal

  const paidCnt   = scheduleRows.filter((r) => r.status === 'paid').length
  const pendCnt   = scheduleRows.filter((r) => r.status === 'pending').length
  const todayIdx  = scheduleRows.reduce((acc, r, i) => (r.status === 'today' || r.status === 'paid') ? i : acc, -1)
  const schedRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!schedRef.current || todayIdx < 0) return
    const el = schedRef.current.querySelector<HTMLTableRowElement>(`#sr-${todayIdx + 1}`)
    if (el) {
      const off = el.offsetTop - 60
      if (off > 0) schedRef.current.scrollTop = off
    }
  }, [d.id, todayIdx, scheduleRows.length])

  const params: ParamItem[] = [
    { label: 'Principal',     value: fD(d.principal),   cls: 'text-[#1e3f7a]' },
    { label: 'Outstanding',   value: fD(calculatedOutstanding) },
    { label: 'Rate',          value: fP(d.rate) },
    {
      label: 'EIR',
      value: `${irrStr} ℹ`,
      cls: 'text-[#1e3f7a] cursor-pointer underline decoration-dotted underline-offset-2 hover:text-[#0f2044]',
      clickable: true,
      onClick: () => onIrrClick(d),
    },
    { label: 'IO months',     value: String(d.io) },
    { label: 'Amort months',  value: String(d.amort) },
    { label: 'Tenure',        value: `${d.tenure}mo` },
    { label: 'Orig fee',      value: fP(d.orig_fee) },
    { label: 'EOT fee',       value: fP(d.eot_fee) },
    {
      label: 'MOIC',
      value: moicVal ? `${moicVal.toFixed(2)}x` : '—',
      cls: 'text-emerald-700',
    },
    ...(d.pik_rate ? [{ label: 'PIK', value: fP(d.pik_rate), cls: 'text-amber-700' }] : []),
  ]

  function autoToolPrompt(tool: string): string {
    const base = `${d.name} (${d.instrument_type}), ${fD(d.principal)} at ${fP(d.rate)}, IO ${d.io}mo, amort ${d.amort}mo, orig ${fP(d.orig_fee)}, EOT ${fP(d.eot_fee)}${d.pik_rate ? `, PIK ${fP(d.pik_rate)}` : ''}`
    switch (tool) {
      case 'irr':    return `Calculate the all-in IRR for: ${base}. Pre-computed EIR: ${irrStr}${moicVal ? `, MOIC: ${moicVal.toFixed(2)}x` : ''}. Confirm EIR and provide: all-in EIR, MOIC, total income, fee decomp in bps (HTML table).`
      case 'amort':  return `Month-by-month amortization schedule for: ${base}. HTML table: Month | Phase | Opening Bal | Interest | Principal | Closing Bal. Show every month up to 36, else every 3rd + final.`
      case 'restr':  return `Restructure options for ${d.name}: ${base}. Compare: (1) base case, (2) maturity +6mo, (3) rate +150bps, (4) covenant waiver +2%, (5) distressed. For each: EIR change in bps, MOIC impact, recommendation.`
      case 'impact': return `IRR impact analysis for ${d.name}: ${base}. Show impact of: maturity +9mo, rate +200bps, covenant waiver. HTML table with EIR before/after/delta for each scenario.`
      case 'cov':    return `Covenant analysis for ${d.name} (${d.instrument_type}, ${fD(d.principal)} at ${fP(d.rate)}, sector: ${d.sector || 'N/A'}, status: ${d.status}). Provide: typical covenants, status assessment, recommended actions. HTML table for covenant list.`
      default:       return ''
    }
  }

  const TOOL_BUTTONS = [
    { id: 'irr',    label: 'IRR',         icon: <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /> },
    { id: 'amort',  label: 'Schedule',    icon: <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></> },
    { id: 'restr',  label: 'Restructure', icon: <><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></> },
    { id: 'impact', label: 'IRR Impact',  icon: <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></> },
    { id: 'cov',    label: 'Covenants',   icon: <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622C17.176 19.29 21 14.591 21 9c0-1.042-.133-2.052-.382-3.016z"/> },
  ].filter(({ id }) => cfg.tools.includes(id))

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* Header */}
        <div className="mb-4 flex items-start gap-3 border-b pb-4" style={{ borderColor: '#e2e6ed' }}>
          <div className="flex h-10 w-10 items-center justify-center rounded-[7px] border text-[20px]"
               style={{ background: '#eaf0fb', borderColor: '#cddaf4' }}>
            {cfg.i}
          </div>
          <div>
            <div className="text-[16px] font-semibold text-[#0d1117]">{d.name}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[11px] text-[#9ca3af]">{cfg.l}</span>
              {d.sector && <><span className="text-[#d0d5df]">·</span><span className="font-mono text-[11px] text-[#9ca3af]">{d.sector}</span></>}
              {d.stage  && <><span className="text-[#d0d5df]">·</span><span className="font-mono text-[11px] text-[#9ca3af]">{d.stage}</span></>}
              <span className="text-[#d0d5df]">·</span>
              <span className={`inline-flex rounded-[5px] px-1.5 py-0.5 font-mono text-[9.5px] font-semibold ${bdg}`}>{stxt}</span>
            </div>
          </div>
        </div>

        {/* Section header */}
        <div className="mb-3 flex items-center gap-2 border-b pb-2" style={{ borderColor: '#e2e6ed' }}>
          <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Deal parameters</span>
        </div>

        {/* Params grid */}
        <div className="mb-5 grid grid-cols-5 gap-1.5">
          {params.map((p) => (
            <div key={p.label} className="rounded-[5px] border bg-[#f7f8fa] px-2.5 py-2" style={{ borderColor: '#e2e6ed' }}>
              <div className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.05em] text-[#9ca3af]">{p.label}</div>
              <div
                className={`text-[13px] font-medium text-[#0d1117] ${p.cls ?? ''}`}
                onClick={p.onClick}
              >
                {p.value}
              </div>
            </div>
          ))}
        </div>

        {/* Schedule header */}
        <div className="mb-2 flex items-center gap-2 border-b pb-2" style={{ borderColor: '#e2e6ed' }}>
          <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Monthly payment schedule</span>
          <span className="rounded-[5px] border border-[#cddaf4] bg-[#eaf0fb] px-2 py-0.5 font-mono text-[9.5px] text-[#1e3f7a]">
            {d.amort > 0 ? `IO ${d.io}m + Amort ${d.amort}m` : 'Bullet'}
          </span>
        </div>

        {/* Summary badges */}
        <div className="mb-2 flex gap-2">
          <span className="rounded-[5px] bg-[#d1fae5] px-2 py-0.5 font-mono text-[11px] text-[#065f46]">✓ {paidCnt} paid</span>
          <span className="rounded-[5px] bg-[#eaf0fb] px-2 py-0.5 font-mono text-[11px] text-[#1e3f7a]">⏳ {pendCnt} pending</span>
        </div>

        {/* Legend */}
        <div className="mb-2 flex flex-wrap gap-3">
          {[
            { color: '#d1fae5', border: '#10b981', label: 'Paid' },
            { color: '#eff6ff', border: '#4f9cf9', label: 'Current' },
            { color: '#fff',    border: '#e2e6ed', label: 'Pending' },
          ].map(({ color, border, label }) => (
            <div key={label} className="flex items-center gap-1 text-[10.5px] text-[#4b5563]">
              <div className="h-3.5 w-3.5 rounded-[2px] border-l-[3px]" style={{ background: color, borderLeftColor: border }} />
              {label}
            </div>
          ))}
        </div>

        {/* Table */}
        <div
          ref={schedRef}
          className="mb-4 max-h-[300px] overflow-y-auto rounded-[7px] border"
          style={{ borderColor: '#e2e6ed' }}
        >
          <table className="w-full border-collapse font-mono text-[11px]">
            <thead>
              <tr style={{ background: '#0f2044', color: 'rgba(255,255,255,0.85)' }}>
                {['Mo.','Date','Phase','Opening bal.','Interest','Principal','Total payment','Closing bal.'].map((h) => (
                  <th key={h} className="sticky top-0 z-10 px-2 py-1.5 text-left text-[9.5px] font-medium tracking-[0.05em]"
                      style={{ background: '#0f2044' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scheduleRows.map((r) => {
                const dateStr = typeof r.date === 'string'
                  ? fDate(new Date(r.date)) + (r.status === 'today' ? ' ◀' : '')
                  : fDate(r.date as unknown as Date) + (r.status === 'today' ? ' ◀' : '')
                return (
                  <tr key={r.m} id={`sr-${r.m}`} className={`row-${r.status}`}>
                    <td className="px-2 py-1.5">{r.m}</td>
                    <td className="px-2 py-1.5">{dateStr}</td>
                    <td className="px-2 py-1.5">{r.phase}</td>
                    <td className="px-2 py-1.5">{fD(r.open_bal)}</td>
                    <td className="px-2 py-1.5">{fD(r.interest)}</td>
                    <td className="px-2 py-1.5">{r.prin > 0 ? fD(r.prin) : '—'}</td>
                    <td className="px-2 py-1.5 font-semibold">{fD(r.total)}</td>
                    <td className="px-2 py-1.5">{fD(r.close_bal)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="text-[11px] text-[#9ca3af]">Use analysis tools below for Claude AI-powered deep dives</p>
      </div>

      {/* Bottom toolbar */}
      <div className="flex shrink-0 items-center gap-1.5 border-t bg-white px-5 py-2.5" style={{ borderColor: '#e2e6ed' }}>
        <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[#9ca3af]">Analysis</span>
        {TOOL_BUTTONS.map(({ id, label, icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTool(id, autoToolPrompt(id))}
            className="flex items-center gap-1 rounded-[5px] border px-2.5 py-1.5 text-[11.5px] transition-all hover:border-[#3d72c8] hover:bg-[#eaf0fb] hover:text-[#1e3f7a]"
            style={{ borderColor: '#d0d5df', background: '#f7f8fa', color: '#4b5563' }}
          >
            <svg viewBox="0 0 24 24" className="h-2.5 w-2.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6">
              {icon}
            </svg>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
