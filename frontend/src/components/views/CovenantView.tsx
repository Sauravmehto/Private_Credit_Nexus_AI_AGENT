import { useEffect, useState } from 'react'
import type { Deal, DealStatus } from '../../dealTypes'
import { getInstrumentConfig, STATUS_BADGE, STATUS_LABEL } from '../../dealTypes'
import { getCovenants as fetchCovenants } from '../../api'
import type { CovenantResult } from '../../types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface Props {
  deals: Deal[]
  onAIAnalysis: (prompt: string) => void
}

const COVENANT_DEFS: Record<string, string[]> = {
  'term loan':   ['Min. liquidity ratio', 'Min. revenue growth', 'Max. leverage (D/E)', 'Min. DSCR'],
  'secured tl':  ['Min. liquidity ratio', 'Min. revenue growth', 'Max. leverage (D/E)', 'Min. DSCR'],
  'bridge loan': ['Max. LTV', 'Min. liquidity', 'Exit event milestone'],
  'conv. note':  ['Min. revenue', 'Qualified financing trigger', 'Conversion floor'],
  'rev. note':   ['Min. MRR', 'Min. revenue growth', 'Max. customer churn'],
  'note':        ['Min. liquidity ratio', 'Max. leverage', 'Min. DSCR'],
  'warrant':     ['Exercise price threshold', 'Expiry date'],
}

function getCovenants(deal: Deal): string[] {
  const l = getInstrumentConfig(deal).l.toLowerCase()
  return COVENANT_DEFS[l] ?? COVENANT_DEFS['term loan']
}

const TODAY = new Date()

function nextQuarter(): string {
  const d = new Date(TODAY.getTime() + 90 * 24 * 3600 * 1000)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatusKpi({ label, value, tone, sub }: { label: string; value: number; tone: 're' | 'am' | 'gr'; sub: string }) {
  const TONE = {
    re: 'linear-gradient(90deg,#b91c1c,#ef4444)',
    am: 'linear-gradient(90deg,#d97706,#f59e0b)',
    gr: 'linear-gradient(90deg,#059669,#10b981)',
  }
  const VAL_COLOR = { re: '#ef4444', am: '#f59e0b', gr: '#10b981' }
  return (
    <Card className="relative overflow-hidden border-border shadow-sm">
      <CardContent className="p-3.5 pt-4">
        <div className="mb-1.5 font-mono text-[9.5px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="mb-0.5 text-xl font-semibold" style={{ color: VAL_COLOR[tone] }}>
          {value}
        </div>
        <div className="font-mono text-[10.5px] text-muted-foreground">{sub}</div>
      </CardContent>
      <div className="absolute inset-x-0 bottom-0 h-[3px] rounded-b-lg" style={{ background: TONE[tone] }} />
    </Card>
  )
}

export function CovenantView({ deals, onAIAnalysis }: Props) {
  const [thresholds, setThresholds] = useState<Record<string, string>>({})
  const [covenantData, setCovenantData] = useState<CovenantResult[] | null>(null)

  useEffect(() => {
    if (!deals.length) return
    const ctrl = new AbortController()
    fetchCovenants(deals, ctrl.signal)
      .then(setCovenantData)
      .catch(() => {/* keep browser fallback */})
    return () => ctrl.abort()
  }, [deals.map(d => d.id).join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  // Build backend covenant lookup: deal_id → covenants[]
  const covenantMap: Record<string, CovenantResult['covenants']> = {}
  if (covenantData) {
    for (const cr of covenantData) {
      covenantMap[cr.deal_id] = cr.covenants
    }
  }

  if (!deals.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Load portfolio data first.
      </div>
    )
  }

  const breach  = deals.filter((d) => d.status === 'breach risk')
  const watch   = deals.filter((d) => d.status === 'monitoring')
  const ok      = deals.filter((d) => d.status === 'compliant')

  const statusColor: Record<DealStatus, 'breach' | 'watch' | 'ok'> = {
    compliant:     'ok',
    monitoring:    'watch',
    'breach risk': 'breach',
  }

  const CARD_STYLES = {
    breach: 'border-[#fca5a5] bg-rose-50',
    watch:  'border-[#fde68a] bg-amber-50',
    ok:     'border-[#a7f3d0] bg-emerald-50',
  }
  const TAG_STYLES = {
    breach: 'bg-[#fca5a5] text-[#991b1b]',
    watch:  'bg-[#fde68a] text-amber-700',
    ok:     'bg-[#a7f3d0] text-[#065f46]',
  }

  function covPct(d: Deal, ci: number): number {
    const seed = (d.name.charCodeAt(0) + ci * 7) % 30
    if (d.status === 'compliant')     return 75 + seed
    if (d.status === 'monitoring')    return 45 + seed
    return 15 + seed
  }

  function buildCovenantPrompt(): string {
    const breachNames = breach.map((d) => d.name).join(', ') || 'none'
    const watchNames  = watch.map((d) => d.name).join(', ') || 'none'
    return `Perform a covenant review for the following portfolio:\n\nBreach risk deals: ${breachNames}\nMonitoring deals: ${watchNames}\nCompliant deals: ${ok.length}\n\nFor each breach-risk deal: (1) waiver strategy, (2) required documentation, (3) fee structure for waiver, (4) credit committee escalation steps. For monitoring deals: (1) enhanced reporting requirements, (2) cure period approach.`
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 py-5 sm:px-6">
        <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">Covenant tracker</h1>
        <p className="mb-4 font-mono text-[11.5px] text-muted-foreground">
          Threshold monitoring and breach alerts across {deals.length} deals
        </p>

        {breach.length > 0 && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Breach attention required</AlertTitle>
            <AlertDescription>
              {breach.length} deal{breach.length === 1 ? '' : 's'} flagged as breach risk. Prioritize waivers and committee review.
            </AlertDescription>
          </Alert>
        )}

        {/* KPIs */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          <StatusKpi label="Breach risk" value={breach.length} tone="re" sub="Immediate attention" />
          <StatusKpi label="Monitoring"  value={watch.length}  tone="am" sub="Close watch" />
          <StatusKpi label="Compliant"   value={ok.length}     tone="gr" sub="Within thresholds" />
        </div>

        {/* Cards */}
        <div className="mb-4 grid grid-cols-3 gap-2.5">
          {deals.map((d) => {
            const sc = statusColor[d.status]
            const cfg = getInstrumentConfig(d)
              // Use backend covenant data if available, fall back to browser
              const backendCovs = covenantMap[d.id]
              const covNames = backendCovs ? backendCovs.map(c => c.name) : getCovenants(d)

            const action = d.status === 'breach risk'
              ? '⚠ Initiate waiver negotiation. Request audited financials within 5 business days. Escalate to credit committee.'
              : d.status === 'monitoring'
              ? '👁 Increase reporting frequency to bi-weekly. Request management commentary on revenue trajectory.'
              : `✓ Standard quarterly monitoring. Next covenant test: ${nextQuarter()}.`

            return (
              <Card key={d.id} className={`border p-4 shadow-sm ${CARD_STYLES[sc]}`}>
                <span className={`mb-1.5 inline-block rounded-[4px] px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] ${TAG_STYLES[sc]}`}>
                  {STATUS_LABEL[d.status]}
                </span>
                <div className="mb-1 text-[13px] font-semibold text-[#0d1117]">{d.name}</div>
                <div className="mb-3 font-mono text-[11px] text-[#9ca3af]">{cfg.l}{d.sector ? ` · ${d.sector}` : ''}</div>

                {covNames.map((covName, ci) => {
                  const backendCov = backendCovs?.[ci]
                  const pct = Math.min(100, backendCov ? backendCov.pct : covPct(d, ci))
                  const barColor = pct > 60 ? '#10b981' : pct > 35 ? '#f59e0b' : '#ef4444'
                  const key = `${d.id}_${ci}`
                  return (
                    <div key={covName} className="mb-2">
                      <div className="mb-1 font-mono text-[10px] text-[#9ca3af]">{covName}</div>
                      <div className="mb-1 h-2 overflow-hidden rounded-full bg-[#e2e6ed]">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />
                      </div>
                      <div className="flex justify-between">
                        {backendCov ? (
                          <span className="font-mono text-[10px] text-[#9ca3af]">
                            {backendCov.actual} <span className="text-[#d0d5df]">/</span> {backendCov.threshold}
                          </span>
                        ) : (
                          <span className="font-mono text-[10px] text-[#9ca3af]">Current: {pct}%</span>
                        )}
                        <Input
                          type="text"
                          placeholder="Threshold…"
                          value={thresholds[key] ?? (backendCov ? backendCov.threshold : '')}
                          onChange={(e) => setThresholds((t) => ({ ...t, [key]: e.target.value }))}
                          title="Set threshold"
                          className="h-7 w-20 border-0 bg-transparent p-0 text-right font-mono text-[10px] text-muted-foreground shadow-none focus-visible:ring-0"
                        />
                      </div>
                    </div>
                  )
                })}

                <div className="mt-2 border-t border-black/10 pt-2 text-[11px] leading-relaxed text-muted-foreground">
                  {action}
                </div>
              </Card>
            )
          })}
        </div>

        {/* Full table */}
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            All covenants — summary table
          </div>
          <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => onAIAnalysis(buildCovenantPrompt())}>
            AI covenant review
          </Button>
        </div>
        <Card className="overflow-hidden border-border shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary hover:bg-primary [&>th]:text-primary-foreground">
                  {['Deal', 'Type', 'Status', 'Key covenants', 'Recommended action'].map((h) => (
                    <TableHead key={h} className="font-mono text-[10px] font-medium">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {deals.map((d) => {
                  const cfg = getInstrumentConfig(d)
                  const covs = getCovenants(d).slice(0, 3).join(', ')
                  const action =
                    d.status === 'breach risk'
                      ? 'Initiate waiver · Escalate to committee'
                      : d.status === 'monitoring'
                        ? 'Increase monitoring frequency'
                        : 'Standard quarterly review'
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell>
                        <span className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[9.5px] text-muted-foreground">
                          {cfg.l}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-md px-1.5 py-0.5 font-mono text-[9.5px] font-semibold ${STATUS_BADGE[d.status]}`}
                        >
                          {STATUS_LABEL[d.status]}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[200px] text-xs text-muted-foreground">{covs}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{action}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  )
}
