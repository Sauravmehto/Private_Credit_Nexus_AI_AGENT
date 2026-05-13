import { useState } from 'react'
import type { Deal } from '../dealTypes'
import { dealIRR, portfolioIRR, buildCashFlows } from '../utils/irrMath'
import { fD, fPct1 } from '../utils/formatters'
import type { PortfolioSummaryResponse } from '../types'

interface Props {
  deal: Deal | null
  allDeals: Deal[]
  backendSummary: PortfolioSummaryResponse | null
  onClose: () => void
}

function IrrRow({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="mb-1 flex items-center justify-between rounded-[5px] bg-[#f7f8fa] px-3 py-1.5 text-[12px]">
      <span className="text-[#4b5563]">{label}</span>
      <span className={`font-mono font-medium ${cls ?? 'text-[#0d1117]'}`}>{value}</span>
    </div>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className={`h-3 w-3 shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
         fill="none" stroke="currentColor" strokeWidth="1.8">
      <polyline points="5 2 11 8 5 14" />
    </svg>
  )
}

function Dropdown({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="mb-3 overflow-hidden rounded-[7px] border" style={{ borderColor: '#e2e6ed' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left transition-colors hover:bg-[#f7f8fa]"
        style={{ background: open ? '#f7f8fa' : '#fff' }}
      >
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-[#4b5563]">{title}</span>
        <div className="flex items-center gap-1 text-[#9ca3af]">
          <span className="font-mono text-[10px]">{open ? 'Hide' : 'Show'}</span>
          <Chevron open={open} />
        </div>
      </button>
      {open && (
        <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: '#e2e6ed' }}>
          {children}
        </div>
      )}
    </div>
  )
}

export function IrrModal({ deal, allDeals, backendSummary, onClose }: Props) {
  const isPortfolio = deal === null
  const irr = deal ? dealIRR(deal) : null

  // Per-deal IRR from backend summary (lookup by deal id)
  const backendDealIRR = deal && backendSummary
    ? backendSummary.deal_irrs.find(di => di.deal_id === deal.id)
    : null

  // Single deal: prefer backend, fall back to browser
  const singleAnnIRR = backendDealIRR?.ann_irr ?? irr?.annIRR ?? null

  // Portfolio: prefer backend port_irr, fall back to browser weighted average
  const portIRRBrowser = isPortfolio ? portfolioIRR(allDeals) : null
  const portIRRVal = isPortfolio
    ? (backendSummary?.port_irr ?? portIRRBrowser)
    : null

  const annIRR = isPortfolio ? portIRRVal : singleAnnIRR
  const title = isPortfolio ? 'Portfolio IRR breakdown' : `${deal!.name} — IRR breakdown`
  const irrStr = annIRR !== null ? fPct1(annIRR) : 'N/A'

  // Build cash-flows for step-by-step section (single deal only)
  const cashFlows = deal ? buildCashFlows(deal) : []
  const previewCFs = cashFlows.length > 0
    ? [
        ...cashFlows.slice(0, Math.min(5, cashFlows.length - 1)),
        ...(cashFlows.length > 6 ? ['…'] as const : []),
        cashFlows[cashFlows.length - 1],
      ]
    : []

  return (
    <div
      className="fixed inset-0 z-[900] flex items-center justify-center"
      style={{ background: 'rgba(5,13,26,0.5)' }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-[560px] max-w-[96vw] flex-col overflow-hidden rounded-[13px] border bg-white shadow-2xl"
        style={{ borderColor: '#e2e6ed' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b px-5 py-4" style={{ borderColor: '#e2e6ed' }}>
          <div className="flex h-8 w-8 items-center justify-center rounded-[7px]"
               style={{ background: 'linear-gradient(135deg, #4f9cf9, #3d72c8)' }}>
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-white">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold text-[#0d1117]">{title}</div>
            {isPortfolio && <div className="font-mono text-[10.5px] text-[#9ca3af]">{allDeals.length} deals</div>}
          </div>
          <button type="button" onClick={onClose}
            className="rounded px-1.5 py-0.5 text-lg leading-none text-[#9ca3af] hover:bg-[#f7f8fa] hover:text-[#0d1117]">×</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">

          {/* Big IRR hero */}
          <div className="mb-5 rounded-[9px] border border-[#cddaf4] bg-[#eaf0fb] px-4 py-4">
            <div className="mb-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#6696db]">
              Effective IRR (annualised)
            </div>
            <div className="text-[36px] font-bold leading-tight text-[#1e3f7a]">{irrStr}</div>
            <div className="font-mono text-[11.5px] text-[#6696db]">
              {isPortfolio
                ? (backendSummary ? 'AI-computed portfolio weighted-average EIR' : 'Portfolio weighted-average EIR')
                : (backendDealIRR ? 'AI-computed all-in EIR' : 'All-in EIR including coupon + fees')}
            </div>
          </div>

          {/* Decomposition — single deal */}
          {!isPortfolio && irr && deal && (
            <>
              <Dropdown title="IRR decomposition" defaultOpen>
                {/* ── Redesigned stacked segment bar ── */}
                {(() => {
                  const tot = (irr.couponBps + irr.origBps + irr.eotBps + irr.pikBps) || 1
                  const segs = [
                    { key: 'coupon', label: 'Coupon', bps: irr.couponBps, pct: irr.couponBps / tot * 100, grad: 'linear-gradient(135deg,#1e3f7a,#2756a3)', light: '#eaf0fb', text: '#1e3f7a' },
                    { key: 'orig',   label: 'Orig',   bps: irr.origBps,   pct: irr.origBps   / tot * 100, grad: 'linear-gradient(135deg,#059669,#10b981)', light: '#d1fae5', text: '#065f46' },
                    { key: 'eot',    label: 'EOT',    bps: irr.eotBps,    pct: irr.eotBps    / tot * 100, grad: 'linear-gradient(135deg,#b45309,#f59e0b)', light: '#fef3c7', text: '#92400e' },
                    ...(irr.pikBps > 0 ? [{ key: 'pik', label: 'PIK', bps: irr.pikBps, pct: irr.pikBps / tot * 100, grad: 'linear-gradient(135deg,#5b21b6,#7c3aed)', light: '#ede9fe', text: '#5b21b6' }] : []),
                  ]
                  return (
                    <div className="mb-4">
                      {/* Bar */}
                      <div className="mb-3 flex h-8 overflow-hidden rounded-[8px] shadow-sm" style={{ background: '#eef0f4' }}>
                        {segs.map((s, i) => (
                          <div
                            key={s.key}
                            className="irr-seg group relative flex items-center justify-center overflow-hidden transition-all duration-300 hover:brightness-110"
                            style={{
                              width: `${s.pct}%`,
                              background: s.grad,
                              borderRadius: i === 0 ? '8px 0 0 8px' : i === segs.length - 1 ? '0 8px 8px 0' : '0',
                            }}
                            title={`${s.label}: ${s.bps} bps`}
                          >
                            {s.pct > 6 && (
                              <span className="select-none font-mono text-[9px] font-semibold text-white drop-shadow">{s.label}</span>
                            )}
                          </div>
                        ))}
                      </div>
                      {/* Stat tiles */}
                      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${segs.length}, 1fr)` }}>
                        {segs.map((s) => (
                          <div key={s.key} className="rounded-[7px] border px-2.5 py-2" style={{ borderColor: s.light, background: s.light }}>
                            <div className="mb-0.5 flex items-center gap-1.5">
                              <div className="h-2 w-2 rounded-full" style={{ background: s.grad }} />
                              <span className="font-mono text-[9px] uppercase tracking-[0.07em]" style={{ color: s.text }}>{s.label === 'Coupon' ? 'Cash coupon' : s.label === 'Orig' ? 'Orig fee' : s.label === 'EOT' ? 'EOT fee' : 'PIK'}</span>
                            </div>
                            <div className="font-mono text-[15px] font-bold leading-tight" style={{ color: s.text }}>{s.bps}<span className="text-[10px] font-normal opacity-70"> bps</span></div>
                            <div className="font-mono text-[9px] opacity-60" style={{ color: s.text }}>{s.pct.toFixed(1)}% of total bps</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}
                <IrrRow label={`Cash coupon (${fPct1(deal.rate)})`} value={`${irr.couponBps} bps`} cls="text-[#1e3f7a]" />
                <IrrRow label={`Origination fee (${fPct1(deal.orig_fee)} amortised)`} value={`+${irr.origBps} bps`} cls="text-emerald-700" />
                <IrrRow label={`EOT fee (${fPct1(deal.eot_fee)} amortised)`} value={`+${irr.eotBps} bps`} cls="text-emerald-700" />
                {irr.pikBps > 0 && <IrrRow label={`PIK (${fPct1(deal.pik_rate)})`} value={`+${irr.pikBps} bps`} cls="text-emerald-700" />}
                <div className="mt-1 flex items-center justify-between rounded-[5px] border border-[#cddaf4] bg-[#eaf0fb] px-3 py-1.5 text-[12px]">
                  <span className="font-semibold text-[#4b5563]">All-in EIR</span>
                  <span className="font-mono text-[13px] font-bold text-[#1e3f7a]">{irrStr}</span>
                </div>
              </Dropdown>

              <Dropdown title="Income breakdown" defaultOpen>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { l: 'Total interest', v: fD(irr.totalInterest), c: `Over ${deal.tenure} months` },
                    { l: 'Origination fee', v: fD(irr.origFeeAmt),   c: `${fPct1(deal.orig_fee)} upfront` },
                    { l: 'EOT fee',         v: fD(irr.eotFeeAmt),    c: `${fPct1(deal.eot_fee)} at maturity` },
                    { l: 'MOIC',            v: `${irr.MOIC.toFixed(2)}x`, c: 'Return multiple' },
                  ].map((item) => (
                    <div key={item.l} className="rounded-[5px] border border-[#e2e6ed] bg-[#f7f8fa] px-3 py-2">
                      <div className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.05em] text-[#9ca3af]">{item.l}</div>
                      <div className="text-[12.5px] font-medium text-[#0d1117]">{item.v}</div>
                      <div className="mt-0.5 text-[10px] text-[#9ca3af]">{item.c}</div>
                    </div>
                  ))}
                </div>
              </Dropdown>
            </>
          )}

          {/* Portfolio per-deal breakdown */}
          {isPortfolio && (
            <Dropdown title={`Per-deal IRR breakdown (${allDeals.length} deals)`} defaultOpen>
              {allDeals.map((d) => {
                const backendEntry = backendSummary?.deal_irrs.find(di => di.deal_id === d.id)
                const annIrrVal = backendEntry?.ann_irr ?? dealIRR(d)?.annIRR ?? 0
                const eirStr = annIrrVal ? fPct1(annIrrVal) : 'N/A'
                return (
                  <IrrRow
                    key={d.id}
                    label={d.name}
                    value={eirStr}
                    cls={annIrrVal > 0.12 ? 'text-emerald-700' : 'text-[#1e3f7a]'}
                  />
                )
              })}
            </Dropdown>
          )}

          {/* Step-by-step calculation (single deal) */}
          {!isPortfolio && deal && cashFlows.length > 0 && (
            <Dropdown title="Step-by-step calculation">
              <div className="mb-3 text-[11.5px] leading-relaxed text-[#4b5563]">
                Showing cash-flow array used to solve for <span className="font-mono font-semibold text-[#1e3f7a]">r</span> (monthly IRR)
                via Newton-Raphson. Net present value of all CFs = 0 at <span className="font-mono font-semibold text-[#1e3f7a]">r = {irr ? (irr.mIRR * 100).toFixed(4) : '—'}%/mo</span>.
              </div>
              <div className="overflow-hidden rounded-[5px] border" style={{ borderColor: '#e2e6ed' }}>
                <table className="w-full border-collapse font-mono text-[11px]">
                  <thead>
                    <tr style={{ background: '#0f2044', color: 'rgba(255,255,255,0.85)' }}>
                      {['Period', 'CF', 'Discounted @ monthly r', 'Cumul. NPV'].map((h) => (
                        <th key={h} className="px-3 py-1.5 text-left text-[9.5px] font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewCFs.map((cf, i) => {
                      if (cf === '…') {
                        return (
                          <tr key="ellipsis">
                            <td colSpan={4} className="px-3 py-1.5 text-center text-[#9ca3af]">
                              ··· {cashFlows.length - 6} months not shown ···
                            </td>
                          </tr>
                        )
                      }
                      const mRate = irr?.mIRR ?? 0
                      const period = i === previewCFs.length - 1 && cashFlows.length > 6
                        ? cashFlows.length - 1
                        : i
                      const discounted = (cf as number) / Math.pow(1 + mRate, period)
                      const cumul = cashFlows.slice(0, period + 1).reduce((s, v, j) => s + v / Math.pow(1 + mRate, j), 0)
                      const isNeg = (cf as number) < 0
                      return (
                        <tr key={i} className="border-b hover:bg-[#f7f8fa]" style={{ borderColor: '#e2e6ed' }}>
                          <td className="px-3 py-1.5 text-[#9ca3af]">
                            {period === 0 ? 'CF₀ (disbursement)' : `CF${period}`}
                          </td>
                          <td className={`px-3 py-1.5 font-semibold ${isNeg ? 'text-rose-600' : 'text-emerald-700'}`}>
                            {isNeg ? '-' : '+'}{fD(Math.abs(cf as number))}
                          </td>
                          <td className="px-3 py-1.5 text-[#4b5563]">
                            {isNeg ? '-' : '+'}{fD(Math.abs(discounted))}
                          </td>
                          <td className={`px-3 py-1.5 ${cumul < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                            {cumul < 0 ? '-' : '+'}{fD(Math.abs(cumul))}
                          </td>
                        </tr>
                      )
                    })}
                    <tr style={{ background: '#eaf0fb' }}>
                      <td className="px-3 py-1.5 font-semibold text-[#1e3f7a]">NPV @ r</td>
                      <td className="px-3 py-1.5 text-[#1e3f7a]">{cashFlows.length} periods</td>
                      <td className="px-3 py-1.5 font-bold text-[#1e3f7a]">≈ 0</td>
                      <td className="px-3 py-1.5 font-bold text-emerald-700">✓ Solved</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Dropdown>
          )}

          {/* How IRR is calculated — dropdown */}
          <Dropdown title="How IRR is calculated">
            <div className="mb-3 rounded-[7px] border border-[#cddaf4] bg-[#eaf0fb] px-4 py-3 font-mono text-[11px] leading-[1.8] text-[#1e3f7a]">
              <div className="mb-2 font-semibold">NPV equation (solve for r):</div>
              <div className="mb-3 text-[12px] font-bold">
                0 = CF₀ + CF₁/(1+r) + CF₂/(1+r)² + … + CFₙ/(1+r)ⁿ
              </div>
              <div className="space-y-1 text-[10.5px] text-[#2756a3]">
                <div>CF₀ = −Principal × (1 − Origination Fee)</div>
                <div>CFₜ = Monthly interest + Principal repayment</div>
                <div>CFₙ = Final payment + EOT fee + remaining balance</div>
                <div className="pt-1 text-[#1e3f7a]">r = monthly IRR → solved via Newton-Raphson iteration</div>
                <div className="font-semibold text-[#1e3f7a]">Annual EIR = (1 + r)¹² − 1</div>
              </div>
            </div>
            <div className="mb-3 rounded-[7px] border border-[#e2e6ed] bg-[#f7f8fa] px-4 py-3 text-[11px] leading-[1.7] text-[#4b5563]">
              <div className="mb-1.5 font-semibold text-[#0d1117]">Newton-Raphson iteration:</div>
              <div className="font-mono text-[10.5px] text-[#6696db]">
                rₙ₊₁ = rₙ − NPV(rₙ) / NPV′(rₙ)
              </div>
              <div className="mt-1.5 text-[10.5px]">
                Converges when |rₙ₊₁ − rₙ| &lt; 10⁻⁷. Max 200 iterations.
                Initial guess: 1%/month. Accounts for IO period, amortisation schedule,
                PIK accrual, origination fee, and EOT exit fee.
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { l: 'Cash coupon', desc: 'Rate × outstanding balance, each month' },
                { l: 'Orig fee', desc: `Reduces CF₀ (net disbursement = P × (1 − fee))` },
                { l: 'EOT fee', desc: 'Added to final cash flow at maturity' },
              ].map(({ l, desc }) => (
                <div key={l} className="rounded-[5px] border border-[#e2e6ed] bg-white px-2.5 py-2">
                  <div className="mb-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.05em] text-[#9ca3af]">{l}</div>
                  <div className="text-[10.5px] leading-relaxed text-[#4b5563]">{desc}</div>
                </div>
              ))}
            </div>
          </Dropdown>

        </div>
      </div>
    </div>
  )
}
