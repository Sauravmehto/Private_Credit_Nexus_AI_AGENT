import type { ReactNode } from 'react'
import type { Deal } from '../dealTypes'
import { dealIRR, portfolioIRR, buildCashFlows } from '../utils/irrMath'
import { fD, fPct1 } from '../utils/formatters'
import type { PortfolioSummaryResponse } from '../types'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ChevronDown } from 'lucide-react'

interface Props {
  deal: Deal | null
  allDeals: Deal[]
  backendSummary: PortfolioSummaryResponse | null
  onClose: () => void
}

function IrrRow({ label, value, cls }: { label: string; value: string; cls?: string }) {
  return (
    <div className="mb-1 flex items-center justify-between rounded-md bg-muted/50 px-3 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono font-medium ${cls ?? 'text-foreground'}`}>{value}</span>
    </div>
  )
}

function IrrSection({ title, defaultOpen, children }: { title: string; defaultOpen?: boolean; children: ReactNode }) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="group mb-3 rounded-lg border border-border">
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="flex h-auto w-full justify-between rounded-none px-4 py-3 font-mono text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/60"
        >
          {title}
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border px-4 pb-4 pt-3">{children}</CollapsibleContent>
    </Collapsible>
  )
}

export function IrrModal({ deal, allDeals, backendSummary, onClose }: Props) {
  const isPortfolio = deal === null
  const irr = deal ? dealIRR(deal) : null

  const backendDealIRR =
    deal && backendSummary ? backendSummary.deal_irrs.find((di) => di.deal_id === deal.id) : null

  const singleAnnIRR = backendDealIRR?.ann_irr ?? irr?.annIRR ?? null

  const portIRRBrowser = isPortfolio ? portfolioIRR(allDeals) : null
  const portIRRVal = isPortfolio ? backendSummary?.port_irr ?? portIRRBrowser : null

  const annIRR = isPortfolio ? portIRRVal : singleAnnIRR
  const title = isPortfolio ? 'Portfolio IRR breakdown' : `${deal!.name} — IRR breakdown`
  const irrStr = annIRR !== null ? fPct1(annIRR) : 'N/A'

  const cashFlows = deal ? buildCashFlows(deal) : []
  const previewCFs =
    cashFlows.length > 0
      ? [
          ...cashFlows.slice(0, Math.min(5, cashFlows.length - 1)),
          ...(cashFlows.length > 6 ? (['…'] as const) : []),
          cashFlows[cashFlows.length - 1],
        ]
      : []

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[90vh] max-w-[560px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-5 py-4 text-left">
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
              style={{ background: 'linear-gradient(135deg, #4f9cf9, #3d72c8)' }}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-white">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" fill="none" stroke="white" strokeWidth="1.8" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-left text-base">{title}</DialogTitle>
              {isPortfolio && (
                <DialogDescription className="text-left font-mono text-[10.5px]">
                  {allDeals.length} deals
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="mb-5 rounded-lg border border-primary/20 bg-primary/5 px-4 py-4">
            <div className="mb-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wide text-primary/80">
              IRR (annualised)
            </div>
            <div className="text-4xl font-bold leading-tight text-primary">{irrStr}</div>
            <div className="font-mono text-[11.5px] text-primary/80">
              {isPortfolio
                ? backendSummary
                  ? 'AI-computed portfolio weighted-average IRR'
                  : 'Portfolio weighted-average IRR'
                : backendDealIRR
                  ? 'AI-computed all-in IRR'
                  : 'All-in IRR including coupon + fees'}
            </div>
          </div>

          {!isPortfolio && irr && deal && (
            <>
              <IrrSection title="IRR decomposition" defaultOpen>
                {(() => {
                  const tot = (irr.couponBps + irr.origBps + irr.eotBps + irr.pikBps) || 1
                  const segs = [
                    {
                      key: 'coupon',
                      label: 'Coupon',
                      bps: irr.couponBps,
                      pct: (irr.couponBps / tot) * 100,
                      grad: 'linear-gradient(135deg,#1e3f7a,#2756a3)',
                      light: '#eaf0fb',
                      text: '#1e3f7a',
                    },
                    {
                      key: 'orig',
                      label: 'Orig',
                      bps: irr.origBps,
                      pct: (irr.origBps / tot) * 100,
                      grad: 'linear-gradient(135deg,#059669,#10b981)',
                      light: '#d1fae5',
                      text: '#065f46',
                    },
                    {
                      key: 'eot',
                      label: 'EOT',
                      bps: irr.eotBps,
                      pct: (irr.eotBps / tot) * 100,
                      grad: 'linear-gradient(135deg,#b45309,#f59e0b)',
                      light: '#fef3c7',
                      text: '#92400e',
                    },
                    ...(irr.pikBps > 0
                      ? [
                          {
                            key: 'pik',
                            label: 'PIK',
                            bps: irr.pikBps,
                            pct: (irr.pikBps / tot) * 100,
                            grad: 'linear-gradient(135deg,#5b21b6,#7c3aed)',
                            light: '#ede9fe',
                            text: '#5b21b6',
                          },
                        ]
                      : []),
                  ]
                  return (
                    <div className="mb-4">
                      <div className="mb-3 flex h-8 overflow-hidden rounded-lg bg-muted shadow-sm">
                        {segs.map((s, i) => (
                          <Tooltip key={s.key}>
                            <TooltipTrigger asChild>
                              <div
                                className="irr-seg relative flex min-w-0 items-center justify-center overflow-hidden transition-all duration-300 hover:brightness-110"
                                style={{
                                  width: `${s.pct}%`,
                                  background: s.grad,
                                  borderRadius:
                                    i === 0 ? '8px 0 0 8px' : i === segs.length - 1 ? '0 8px 8px 0' : '0',
                                }}
                              >
                                {s.pct > 6 && (
                                  <span className="select-none font-mono text-[9px] font-semibold text-white drop-shadow">
                                    {s.label}
                                  </span>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="font-mono text-xs">
                              {s.label}: {s.bps} bps ({s.pct.toFixed(1)}% of total)
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${segs.length}, 1fr)` }}>
                        {segs.map((s) => (
                          <Tooltip key={s.key}>
                            <TooltipTrigger asChild>
                              <div
                                className="cursor-default rounded-md border px-2.5 py-2 text-left"
                                style={{ borderColor: s.light, background: s.light }}
                              >
                                <div className="mb-0.5 flex items-center gap-1.5">
                                  <div className="h-2 w-2 rounded-full" style={{ background: s.grad }} />
                                  <span className="font-mono text-[9px] uppercase tracking-wide" style={{ color: s.text }}>
                                    {s.label === 'Coupon'
                                      ? 'Cash coupon'
                                      : s.label === 'Orig'
                                        ? 'Orig fee'
                                        : s.label === 'EOT'
                                          ? 'EOT fee'
                                          : 'PIK'}
                                  </span>
                                </div>
                                <div className="font-mono text-[15px] font-bold leading-tight" style={{ color: s.text }}>
                                  {s.bps}
                                  <span className="text-[10px] font-normal opacity-70"> bps</span>
                                </div>
                                <div className="font-mono text-[9px] opacity-60" style={{ color: s.text }}>
                                  {s.pct.toFixed(1)}% of total bps
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>Contribution to all-in IRR (basis points)</TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  )
                })()}
                <IrrRow label={`Cash coupon (${fPct1(deal.rate)})`} value={`${irr.couponBps} bps`} cls="text-primary" />
                <IrrRow
                  label={`Origination fee (${fPct1(deal.orig_fee)} amortised)`}
                  value={`+${irr.origBps} bps`}
                  cls="text-emerald-700"
                />
                <IrrRow label={`EOT fee (${fPct1(deal.eot_fee)} amortised)`} value={`+${irr.eotBps} bps`} cls="text-emerald-700" />
                {irr.pikBps > 0 && (
                  <IrrRow label={`PIK (${fPct1(deal.pik_rate)})`} value={`+${irr.pikBps} bps`} cls="text-emerald-700" />
                )}
                <div className="mt-1 flex items-center justify-between rounded-md border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs">
                  <span className="font-semibold text-muted-foreground">All-in IRR</span>
                  <span className="font-mono text-[13px] font-bold text-primary">{irrStr}</span>
                </div>
              </IrrSection>

              <IrrSection title="Income breakdown" defaultOpen>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { l: 'Total interest', v: fD(irr.totalInterest), c: `Over ${deal.tenure} months` },
                    { l: 'Origination fee', v: fD(irr.origFeeAmt), c: `${fPct1(deal.orig_fee)} upfront` },
                    { l: 'EOT fee', v: fD(irr.eotFeeAmt), c: `${fPct1(deal.eot_fee)} at maturity` },
                    { l: 'MOIC', v: `${irr.MOIC.toFixed(2)}x`, c: 'Return multiple' },
                  ].map((item) => (
                    <div key={item.l} className="rounded-md border border-border bg-muted/40 px-3 py-2">
                      <div className="mb-1 font-mono text-[9.5px] uppercase tracking-wide text-muted-foreground">{item.l}</div>
                      <div className="text-sm font-medium text-foreground">{item.v}</div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">{item.c}</div>
                    </div>
                  ))}
                </div>
              </IrrSection>
            </>
          )}

          {isPortfolio && (
            <IrrSection title={`Per-deal IRR breakdown (${allDeals.length} deals)`} defaultOpen>
              {allDeals.map((dRow) => {
                const backendEntry = backendSummary?.deal_irrs.find((di) => di.deal_id === dRow.id)
                const annIrrVal = backendEntry?.ann_irr ?? dealIRR(dRow)?.annIRR ?? 0
                const irrValueStr = annIrrVal ? fPct1(annIrrVal) : 'N/A'
                return (
                  <IrrRow
                    key={dRow.id}
                    label={dRow.name}
                    value={irrValueStr}
                    cls={annIrrVal > 0.12 ? 'text-emerald-700' : 'text-primary'}
                  />
                )
              })}
            </IrrSection>
          )}

          {!isPortfolio && deal && cashFlows.length > 0 && (
            <IrrSection title="Step-by-step calculation">
              <div className="mb-3 text-[11.5px] leading-relaxed text-muted-foreground">
                Showing cash-flow array used to solve for{' '}
                <span className="font-mono font-semibold text-primary">r</span> (monthly IRR) via Newton-Raphson. Net present
                value of all CFs = 0 at{' '}
                <span className="font-mono font-semibold text-primary">
                  r = {irr ? (irr.mIRR * 100).toFixed(4) : '—'}%/mo
                </span>
                .
              </div>
              <div className="overflow-hidden rounded-md border border-border">
                <table className="w-full border-collapse font-mono text-[11px]">
                  <thead>
                    <tr className="bg-primary text-primary-foreground">
                      {['Period', 'CF', 'Discounted @ monthly r', 'Cumul. NPV'].map((h) => (
                        <th key={h} className="px-3 py-1.5 text-left text-[9.5px] font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewCFs.map((cf, i) => {
                      if (cf === '…') {
                        return (
                          <tr key="ellipsis">
                            <td colSpan={4} className="px-3 py-1.5 text-center text-muted-foreground">
                              ··· {cashFlows.length - 6} months not shown ···
                            </td>
                          </tr>
                        )
                      }
                      const mRate = irr?.mIRR ?? 0
                      const period =
                        i === previewCFs.length - 1 && cashFlows.length > 6 ? cashFlows.length - 1 : i
                      const discounted = (cf as number) / (1 + mRate) ** period
                      const cumul = cashFlows
                        .slice(0, period + 1)
                        .reduce((s, v, j) => s + v / (1 + mRate) ** j, 0)
                      const isNeg = (cf as number) < 0
                      return (
                        <tr key={i} className="border-b border-border hover:bg-muted/40">
                          <td className="px-3 py-1.5 text-muted-foreground">
                            {period === 0 ? 'CF₀ (disbursement)' : `CF${period}`}
                          </td>
                          <td className={`px-3 py-1.5 font-semibold ${isNeg ? 'text-destructive' : 'text-emerald-700'}`}>
                            {isNeg ? '-' : '+'}
                            {fD(Math.abs(cf as number))}
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground">
                            {isNeg ? '-' : '+'}
                            {fD(Math.abs(discounted))}
                          </td>
                          <td className={`px-3 py-1.5 ${cumul < 0 ? 'text-destructive' : 'text-emerald-700'}`}>
                            {cumul < 0 ? '-' : '+'}
                            {fD(Math.abs(cumul))}
                          </td>
                        </tr>
                      )
                    })}
                    <tr className="bg-primary/10">
                      <td className="px-3 py-1.5 font-semibold text-primary">NPV @ r</td>
                      <td className="px-3 py-1.5 text-primary">{cashFlows.length} periods</td>
                      <td className="px-3 py-1.5 font-bold text-primary">≈ 0</td>
                      <td className="px-3 py-1.5 font-bold text-emerald-700">✓ Solved</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </IrrSection>
          )}

          <IrrSection title="How IRR is calculated">
            <div className="mb-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 font-mono text-[11px] leading-relaxed text-primary">
              <div className="mb-2 font-semibold">NPV equation (solve for r):</div>
              <div className="mb-3 text-xs font-bold">0 = CF₀ + CF₁/(1+r) + CF₂/(1+r)² + … + CFₙ/(1+r)ⁿ</div>
              <div className="space-y-1 text-[10.5px] text-primary/90">
                <div>CF₀ = −Principal × (1 − Origination Fee)</div>
                <div>CFₜ = Monthly interest + Principal repayment</div>
                <div>CFₙ = Final payment + EOT fee + remaining balance</div>
                <div className="pt-1">r = monthly IRR → solved via Newton-Raphson iteration</div>
                <div className="font-semibold">Annual IRR = (1 + r)¹² − 1</div>
              </div>
            </div>
            <div className="mb-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-[11px] leading-relaxed text-muted-foreground">
              <div className="mb-1.5 font-semibold text-foreground">Newton-Raphson iteration:</div>
              <div className="font-mono text-[10.5px] text-primary/80">rₙ₊₁ = rₙ − NPV(rₙ) / NPV′(rₙ)</div>
              <div className="mt-1.5 text-[10.5px]">
                Converges when |rₙ₊₁ − rₙ| &lt; 10⁻⁷. Max 200 iterations. Initial guess: 1%/month. Accounts for IO period,
                amortisation schedule, PIK accrual, origination fee, and EOT exit fee.
              </div>
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
              {[
                { l: 'Cash coupon', desc: 'Rate × outstanding balance, each month' },
                { l: 'Orig fee', desc: 'Reduces CF₀ (net disbursement = P × (1 − fee))' },
                { l: 'EOT fee', desc: 'Added to final cash flow at maturity' },
              ].map(({ l, desc }) => (
                <div key={l} className="rounded-md border border-border bg-card px-2.5 py-2">
                  <div className="mb-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {l}
                  </div>
                  <div className="text-[10.5px] leading-relaxed text-muted-foreground">{desc}</div>
                </div>
              ))}
            </div>
          </IrrSection>
        </div>
      </DialogContent>
    </Dialog>
  )
}
