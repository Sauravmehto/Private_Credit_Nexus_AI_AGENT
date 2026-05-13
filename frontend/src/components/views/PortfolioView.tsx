import type { Deal } from '../../dealTypes'
import { getInstrumentConfig, STATUS_BADGE, STATUS_LABEL } from '../../dealTypes'
import { dealIRR, portfolioIRR } from '../../utils/irrMath'
import { fD, fP, fPct1 } from '../../utils/formatters'
import type { PortfolioSummaryResponse } from '../../types'

interface Props {
  deals: Deal[]
  backendSummary: PortfolioSummaryResponse | null
  summaryLoading: boolean
  onDealSelect: (id: string) => void
  onIrrClick: (deal: Deal | null) => void
  onAIAnalysis: () => void
}

interface KpiProps {
  label: string
  value: string
  sub: string
  tone: 'bl' | 'gr' | 'am' | 're' | 'pu' | 'cy'
  onClick?: () => void
}

const TONE_GRADIENT: Record<KpiProps['tone'], string> = {
  bl: 'linear-gradient(90deg, #1e3f7a, #4f9cf9)',
  gr: 'linear-gradient(90deg, #059669, #10b981)',
  am: 'linear-gradient(90deg, #d97706, #f59e0b)',
  re: 'linear-gradient(90deg, #b91c1c, #ef4444)',
  pu: 'linear-gradient(90deg, #6d28d9, #7c3aed)',
  cy: 'linear-gradient(90deg, #0891b2, #06b6d4)',
}

function KpiCard({ label, value, sub, tone, onClick }: KpiProps) {
  return (
    <div className="relative overflow-hidden rounded-[9px] border bg-white p-3.5" style={{ borderColor: '#e2e6ed' }}>
      <div className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.06em] text-[#9ca3af]">{label}</div>
      <div
        className={`mb-0.5 text-[20px] font-semibold leading-tight text-[#0d1117] ${onClick ? 'cursor-pointer underline decoration-dotted underline-offset-2 text-[#1e3f7a] hover:text-[#162d5e]' : ''}`}
        onClick={onClick}
      >
        {value}
      </div>
      <div className="font-mono text-[10.5px] text-[#9ca3af]">{sub}</div>
      <div className="absolute inset-x-0 bottom-0 h-[3px] rounded-b-[9px]" style={{ background: TONE_GRADIENT[tone] }} />
    </div>
  )
}

export function PortfolioView({ deals, backendSummary, summaryLoading, onDealSelect, onIrrClick, onAIAnalysis }: Props) {
  if (!deals.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-10 text-center">
        <div className="mb-4 text-5xl">📂</div>
        <div className="mb-2 text-[15px] font-semibold text-[#0d1117]">No portfolio data</div>
        <div className="mb-5 text-[12px] text-[#9ca3af]">Upload your portfolio file to get started.</div>
      </div>
    )
  }

  const aum = deals.reduce((s, d) => s + (d.principal || 0), 0)
  const nCC = deals.filter((d) => d.status === 'compliant').length
  const nM  = deals.filter((d) => d.status === 'monitoring').length
  const nB  = deals.filter((d) => d.status === 'breach risk').length
  const avgDeal = deals.length ? aum / deals.length : 0
  const wtdRate = aum > 0 ? deals.reduce((s, d) => s + d.rate * (d.principal / (aum || 1)), 0) : 0

  // Portfolio IRR: use backend value when available, fall back to browser calculation
  const portIRRBrowser = portfolioIRR(deals)
  const portIRRVal = backendSummary ? backendSummary.port_irr : portIRRBrowser

  // Build a lookup map from backend per-deal IRRs
  const dealIRRMap: Record<string, number> = {}
  if (backendSummary) {
    for (const di of backendSummary.deal_irrs) {
      dealIRRMap[di.deal_id] = di.ann_irr
    }
  }


  const cp = deals.length ? Math.round(nCC / deals.length * 100) : 0
  const mp = deals.length ? Math.round(nM  / deals.length * 100) : 0
  const rp = deals.length ? Math.round(nB  / deals.length * 100) : 0

  const instMap: Record<string, number> = {}
  deals.forEach((d) => {
    const l = getInstrumentConfig(d).l
    instMap[l] = (instMap[l] || 0) + 1
  })

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-5">
        <div className="mb-0.5 text-[18px] font-semibold tracking-tight text-[#0d1117]">Portfolio overview</div>
        <div className="mb-4 font-mono text-[11.5px] text-[#9ca3af]">
          {deals.length} deals · {Object.keys(instMap).join(', ')}
        </div>

        {/* KPI row */}
        <div className="mb-3 grid grid-cols-6 gap-2">
          <KpiCard label="AUM" value={fD(aum)} sub={`${deals.length} deals`} tone="bl" />
          <KpiCard label="Deals" value={String(deals.length)} sub={`${Object.keys(instMap).length} types`} tone="bl" />
          <KpiCard label="Avg size" value={fD(avgDeal)} sub="per deal" tone="gr" />
          <KpiCard label="Wtd rate" value={fP(wtdRate)} sub="cash coupon" tone="am" />
          <KpiCard
            label="Portfolio IRR"
            value={summaryLoading ? '…' : portIRRVal ? fPct1(portIRRVal) : 'N/A'}
            sub={backendSummary ? 'AI-computed EIR' : 'wtd-avg EIR'}
            tone="cy"
            onClick={() => onIrrClick(null)}
          />
          <KpiCard
            label="Breach risk"
            value={String(nB)}
            sub={`${rp}% of portfolio`}
            tone="re"
          />
        </div>

        {/* Health + mix */}
        <div className="mb-3 grid grid-cols-2 gap-3">
          {/* Deal health */}
          <div className="rounded-[11px] border bg-white p-4" style={{ borderColor: '#e2e6ed' }}>
            <div className="mb-3 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Deal health</div>
            <div className="mb-2 flex h-1.5 overflow-hidden rounded-[3px] bg-[#eef0f4]">
              <div className="h-full rounded-l-[2px] bg-emerald-500" style={{ width: `${cp}%` }} />
              <div className="h-full bg-amber-400" style={{ width: `${mp}%` }} />
              <div className="h-full rounded-r-[2px] bg-rose-500" style={{ width: `${rp}%` }} />
            </div>
            <div className="flex gap-3">
              {[
                { color: '#10b981', label: `${nCC} Compliant` },
                { color: '#f59e0b', label: `${nM} Watch` },
                { color: '#ef4444', label: `${nB} Breach` },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1 text-[11px] text-[#4b5563]">
                  <div className="h-1.5 w-1.5 rounded-[2px]" style={{ background: color }} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* Instrument mix */}
          <div className="rounded-[11px] border bg-white p-4" style={{ borderColor: '#e2e6ed' }}>
            <div className="mb-3 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Instrument mix</div>
            <div className="grid grid-cols-3 gap-1.5">
              {Object.entries(instMap).map(([k, v]) => (
                <div key={k} className="rounded-[5px] bg-[#f7f8fa] px-2 py-1.5">
                  <div className="font-mono text-[9.5px] text-[#9ca3af]">{k}</div>
                  <div className="text-[12.5px] font-medium text-[#0d1117]">{v}</div>
                  <div className="text-[9.5px] text-emerald-600">{Math.round(v / deals.length * 100)}%</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Deal list */}
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[#9ca3af]">All deals</div>
          <button
            type="button"
            onClick={onAIAnalysis}
            className="rounded-[5px] border px-2.5 py-1 text-[11px] transition-colors"
            style={{ borderColor: '#d0d5df', background: '#f7f8fa', color: '#4b5563' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#9bbae8'; e.currentTarget.style.color = '#1e3f7a' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#d0d5df'; e.currentTarget.style.color = '#4b5563' }}
          >
            ▶ AI analysis
          </button>
        </div>

        <div className="space-y-1.5">
          {deals.map((d) => {
            const cfg = getInstrumentConfig(d)
            const browserIRR = dealIRR(d)?.annIRR ?? 0
            const displayIRR = dealIRRMap[d.id] ?? browserIRR
            const bdg  = STATUS_BADGE[d.status] ?? 'bg-slate-100 text-slate-700'
            const stxt = STATUS_LABEL[d.status] ?? d.status
            const dot  = d.status === 'compliant' ? '#10b981' : d.status === 'monitoring' ? '#f59e0b' : '#ef4444'

            return (
              <div
                key={d.id}
                className="flex cursor-pointer items-center gap-3 rounded-[5px] border bg-white px-3 py-2.5 transition-all hover:translate-x-0.5 hover:border-[#d0d5df] hover:bg-[#f7f8fa]"
                style={{ borderColor: '#e2e6ed' }}
                onClick={() => onDealSelect(d.id)}
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: dot }} />
                <span className="text-[15px]">{cfg.i}</span>
                <span className="flex-1 text-[12.5px] font-medium text-[#0d1117]">{d.name}</span>
                {d.sector && (
                  <span className="rounded-[3px] border border-[#e2e6ed] bg-[#f7f8fa] px-1.5 py-0.5 font-mono text-[9.5px] text-[#9ca3af]">{d.sector}</span>
                )}
                <span className="rounded-[3px] border border-[#e2e6ed] bg-[#f7f8fa] px-1.5 py-0.5 font-mono text-[9.5px] text-[#9ca3af]">{cfg.l}</span>
                <span className="min-w-[52px] text-right font-mono text-[11.5px] text-[#4b5563]">{fD(d.principal)}</span>
                <span className="min-w-[44px] text-right font-mono text-[11.5px] text-[#1e3f7a]">{fP(d.rate)}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onIrrClick(d) }}
                  className="min-w-[60px] rounded-[3px] bg-[#d1fae5] px-1.5 py-0.5 text-right font-mono text-[11.5px] text-[#065f46] transition-colors hover:bg-[#eaf0fb] hover:text-[#1e3f7a]"
                >
                  EIR {displayIRR ? fPct1(displayIRR) : summaryLoading ? '…' : '—'}
                </button>
                <span className={`inline-flex rounded-[5px] px-1.5 py-0.5 font-mono text-[9.5px] font-semibold ${bdg}`}>
                  {stxt}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
