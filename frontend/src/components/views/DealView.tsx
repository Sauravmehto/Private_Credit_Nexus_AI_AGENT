import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Deal } from '../../dealTypes'
import { getInstrumentConfig, STATUS_BADGE, STATUS_LABEL } from '../../dealTypes'
import { dealIRR, buildAmortSchedule } from '../../utils/irrMath'
import {
  applyDraftChange,
  buildScenarioDeal,
  browserAmortToApiRows,
  draftFromDeal,
  scheduleBadgeLabel,
  validateScenarioDraft,
  type ScenarioDraft,
  type ScenarioField,
} from '../../utils/scenarioValidation'
import { fD, fP, fPct1, fDate } from '../../utils/formatters'
import {
  createSavedScenario,
  pushSavedScenario,
  type SavedScenario,
} from '../../utils/savedScenarios'
import { getDealMetrics, getAmortization } from '../../api'
import type { DealMetricsResponse, AmortRowResponse, PortfolioSummaryResponse } from '../../types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChevronDown } from 'lucide-react'

interface Props {
  deal: Deal
  backendSummary: PortfolioSummaryResponse | null
  onIrrClick: (deal: Deal) => void
  onTool: (tool: string, prompt: string) => void
}

function metricsFromBrowser(deal: Deal): DealMetricsResponse | null {
  const r = dealIRR(deal)
  if (!r) return null
  return {
    ann_irr: r.annIRR,
    m_irr: r.mIRR,
    moic: r.MOIC,
    total_income: r.totalIncome,
    total_interest: r.totalInterest,
    orig_fee_amt: r.origFeeAmt,
    eot_fee_amt: r.eotFeeAmt,
    coupon_bps: r.couponBps,
    orig_bps: r.origBps,
    eot_bps: r.eotBps,
    pik_bps: r.pikBps,
  }
}

function browserScheduleFallback(deal: Deal): AmortRowResponse[] {
  return buildAmortSchedule(deal).map((r) => ({
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

function ParamCellShell({ label, err, children }: { label: string; err?: string; children: ReactNode }) {
  return (
    <div className="rounded-[5px] border bg-[#f7f8fa] px-2.5 py-2" style={{ borderColor: err ? '#fca5a5' : '#e2e6ed' }}>
      <div className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.05em] text-[#9ca3af]">{label}</div>
      {children}
      {err ? <p className="mt-0.5 font-mono text-[9px] text-red-600">{err}</p> : null}
    </div>
  )
}

function ParamCell({
  label,
  field,
  scenarioMode,
  draft,
  fieldErrors,
  onDraftChange,
  display,
  cls,
  onClick,
}: {
  label: string
  field: ScenarioField | null
  scenarioMode: boolean
  draft: ScenarioDraft
  fieldErrors: Partial<Record<ScenarioField, string>>
  onDraftChange: (field: ScenarioField, value: string) => void
  display: ReactNode
  cls?: string
  onClick?: () => void
}) {
  const editable = scenarioMode && field !== null
  const err = field ? fieldErrors[field] : undefined

  return (
    <ParamCellShell label={label} err={err}>
      {editable && field ? (
        <div className="flex items-center gap-0.5">
          <Input
            type="number"
            step={field === 'ratePct' ? '0.01' : '1'}
            value={draft[field]}
            onChange={(e) => onDraftChange(field, e.target.value)}
            className={`h-7 px-1.5 font-mono text-[12px] ${err ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
            aria-invalid={!!err}
            aria-label={label}
          />
          {field === 'ratePct' && <span className="shrink-0 text-[11px] text-[#9ca3af]">%</span>}
          {field === 'tenure' && <span className="shrink-0 text-[11px] text-[#9ca3af]">mo</span>}
        </div>
      ) : (
        <div
          className={`text-[13px] font-medium text-[#0d1117] ${cls ?? ''} ${onClick ? 'cursor-pointer' : ''}`}
          onClick={onClick}
          onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
          role={onClick ? 'button' : undefined}
          tabIndex={onClick ? 0 : undefined}
        >
          {display}
        </div>
      )}
    </ParamCellShell>
  )
}

export function DealView({ deal: d, backendSummary, onIrrClick, onTool }: Props) {
  const cfg = getInstrumentConfig(d)
  const bdg = STATUS_BADGE[d.status] ?? ''
  const stxt = STATUS_LABEL[d.status] ?? d.status

  const [scenarioMode, setScenarioMode] = useState(false)
  const [activeTab, setActiveTab] = useState<'base' | string>('base')
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([])
  const [draft, setDraft] = useState<ScenarioDraft>(() => draftFromDeal(d))
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ScenarioField, string>>>({})
  const [calculating, setCalculating] = useState(false)
  const [metrics, setMetrics] = useState<DealMetricsResponse | null>(null)
  const [amortRows, setAmortRows] = useState<AmortRowResponse[] | null>(null)

  const scenarioActive = activeTab !== 'base'

  const loadBaseDeal = useCallback(() => {
    const ctrl = new AbortController()
    setMetrics(null)
    setAmortRows(null)
    getDealMetrics(d, ctrl.signal)
      .then(setMetrics)
      .catch(() => {
        setMetrics(metricsFromBrowser(d))
      })
    getAmortization(d, ctrl.signal)
      .then(setAmortRows)
      .catch(() => {
        setAmortRows(browserScheduleFallback(d))
      })
    return () => ctrl.abort()
  }, [d])

  useEffect(() => {
    setScenarioMode(false)
    setActiveTab('base')
    setSavedScenarios([])
    setDraft(draftFromDeal(d))
    setFieldErrors({})
    return loadBaseDeal()
  }, [d.id, loadBaseDeal])

  const activeDeal: Deal = (() => {
    if (!scenarioActive) return d
    try {
      return buildScenarioDeal(d, draft)
    } catch {
      return d
    }
  })()

  const browserIRR = dealIRR(activeDeal)
  const backendDealIRR = backendSummary?.deal_irrs.find((di) => di.deal_id === d.id)
  const annIRR = metrics?.ann_irr ?? backendDealIRR?.ann_irr ?? browserIRR?.annIRR ?? 0
  const moicVal = metrics?.moic ?? backendDealIRR?.moic ?? browserIRR?.MOIC ?? 0
  const irrStr = annIRR ? fPct1(annIRR) : 'N/A'

  const scheduleRows =
    amortRows ??
    (scenarioActive ? browserAmortToApiRows(activeDeal) : browserScheduleFallback(d))

  const latestBalanceRow = [...scheduleRows]
    .reverse()
    .find((r) => r.status === 'today' || r.status === 'paid')
  const calculatedOutstanding = latestBalanceRow?.close_bal ?? d.outstanding ?? d.principal

  const paidCnt = scheduleRows.filter((r) => r.status === 'paid').length
  const pendCnt = scheduleRows.filter((r) => r.status === 'pending').length
  const todayIdx = scheduleRows.reduce(
    (acc, r, i) => (r.status === 'today' || r.status === 'paid' ? i : acc),
    -1,
  )
  const schedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!schedRef.current || todayIdx < 0) return
    const el = schedRef.current.querySelector<HTMLTableRowElement>(`#sr-${todayIdx + 1}`)
    if (el) {
      const off = el.offsetTop - 60
      if (off > 0) schedRef.current.scrollTop = off
    }
  }, [d.id, todayIdx, scheduleRows.length])

  const displayIo = scenarioActive ? parseInt(draft.io, 10) || d.io : d.io
  const displayAmort = scenarioActive ? parseInt(draft.amort, 10) || d.amort : d.amort
  const scheduleBadge = scheduleBadgeLabel(displayIo, displayAmort)

  const draftValid = validateScenarioDraft(draft).valid

  function handleDraftChange(field: ScenarioField, value: string) {
    const next = applyDraftChange(draft, field, value)
    setDraft(next)
    if (fieldErrors[field]) {
      const { errors } = validateScenarioDraft(next)
      setFieldErrors(errors)
    }
  }

  function applySnapshot(snapshot: SavedScenario) {
    setDraft({ ...snapshot.draft })
    setMetrics(snapshot.metrics)
    setAmortRows(snapshot.amortRows)
  }

  function handleTabChange(tab: string) {
    setActiveTab(tab)
    setScenarioMode(false)
    setFieldErrors({})
    if (tab === 'base') {
      setDraft(draftFromDeal(d))
      loadBaseDeal()
      return
    }
    const snap = savedScenarios.find((s) => s.id === tab)
    if (snap) applySnapshot(snap)
  }

  function handleChangeScenario() {
    setScenarioMode(true)
    if (activeTab === 'base') {
      setDraft(draftFromDeal(d))
    }
    setFieldErrors({})
  }

  async function handleCalculate() {
    const { valid, errors } = validateScenarioDraft(draft)
    setFieldErrors(errors)
    if (!valid) return

    let scenarioDeal: Deal
    try {
      scenarioDeal = buildScenarioDeal(d, draft)
    } catch {
      return
    }

    setCalculating(true)
    let m: DealMetricsResponse | null = null
    let rows: AmortRowResponse[] = []
    try {
      const [apiMetrics, apiRows] = await Promise.all([
        getDealMetrics(scenarioDeal),
        getAmortization(scenarioDeal),
      ])
      m = apiMetrics
      rows = apiRows
    } catch {
      m = metricsFromBrowser(scenarioDeal)
      rows = browserAmortToApiRows(scenarioDeal)
    } finally {
      setCalculating(false)
    }

    const snapshot = createSavedScenario(draft, m, rows)
    setSavedScenarios((prev) => pushSavedScenario(prev, snapshot))
    setActiveTab(snapshot.id)
    setScenarioMode(false)
    setMetrics(m)
    setAmortRows(rows)
  }

  function handleResetToBase() {
    handleTabChange('base')
  }

  function handleCancelScenario() {
    setScenarioMode(false)
    setFieldErrors({})
    if (activeTab === 'base') {
      setDraft(draftFromDeal(d))
      loadBaseDeal()
      return
    }
    const snap = savedScenarios.find((s) => s.id === activeTab)
    if (snap) applySnapshot(snap)
  }

  function autoToolPrompt(tool: string): string {
    const dealRef = scenarioActive ? activeDeal : d
    const base = `${dealRef.name} (${dealRef.instrument_type}), ${fD(dealRef.principal)} at ${fP(dealRef.rate)}, IO ${dealRef.io}mo, amort ${dealRef.amort}mo, orig ${fP(dealRef.orig_fee)}, EOT ${fP(dealRef.eot_fee)}${dealRef.pik_rate ? `, PIK ${fP(dealRef.pik_rate)}` : ''}`
    switch (tool) {
      case 'irr':
        return `Calculate the all-in IRR for: ${base}. Pre-computed IRR: ${irrStr}${moicVal ? `, MOIC: ${moicVal.toFixed(2)}x` : ''}. Confirm IRR and provide: all-in IRR, MOIC, total income, fee decomp in bps (Markdown table).`
      case 'amort':
        return `Month-by-month amortization schedule for: ${base}. Markdown table: Month | Phase | Opening Bal | Interest | Principal | EOT Fee | Total Payment | Closing Bal. Show every month up to 36, else every 3rd + final.`
      case 'restr':
        return `Restructure options for ${dealRef.name}: ${base}. Compare: (1) base case, (2) maturity +6mo, (3) rate +150bps, (4) covenant waiver +2%, (5) distressed. For each: IRR change in bps, MOIC impact, recommendation.`
      case 'impact':
        return `IRR impact analysis for ${dealRef.name}: ${base}. Show impact of: maturity +9mo, rate +200bps, covenant waiver. Markdown table with IRR before/after/delta for each scenario.`
      case 'cov':
        return `Covenant analysis for ${dealRef.name} (${dealRef.instrument_type}, ${fD(dealRef.principal)} at ${fP(dealRef.rate)}, sector: ${dealRef.sector || 'N/A'}, status: ${dealRef.status}). Provide: typical covenants, status assessment, recommended actions. HTML table for covenant list.`
      default:
        return ''
    }
  }

  const TOOL_BUTTONS = [
    { id: 'irr', label: 'IRR', icon: <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /> },
    {
      id: 'amort',
      label: 'Schedule',
      icon: (
        <>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </>
      ),
    },
    {
      id: 'restr',
      label: 'Restructure',
      icon: (
        <>
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 014-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 01-4 4H3" />
        </>
      ),
    },
    {
      id: 'impact',
      label: 'IRR Impact',
      icon: (
        <>
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </>
      ),
    },
    {
      id: 'cov',
      label: 'Covenants',
      icon: (
        <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622C17.176 19.29 21 14.591 21 9c0-1.042-.133-2.052-.382-3.016z" />
      ),
    },
  ].filter(({ id }) => cfg.tools.includes(id))

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* Header */}
        <div className="mb-4 flex items-start gap-3 border-b pb-4" style={{ borderColor: '#e2e6ed' }}>
          <div
            className="flex h-10 w-10 items-center justify-center rounded-[7px] border text-[20px]"
            style={{ background: '#eaf0fb', borderColor: '#cddaf4' }}
          >
            {cfg.i}
          </div>
          <div>
            <div className="text-[16px] font-semibold text-[#0d1117]">{d.name}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[11px] text-[#9ca3af]">{cfg.l}</span>
              {d.sector && (
                <>
                  <span className="text-[#d0d5df]">·</span>
                  <span className="font-mono text-[11px] text-[#9ca3af]">{d.sector}</span>
                </>
              )}
              {d.stage && (
                <>
                  <span className="text-[#d0d5df]">·</span>
                  <span className="font-mono text-[11px] text-[#9ca3af]">{d.stage}</span>
                </>
              )}
              <span className="text-[#d0d5df]">·</span>
              <span className={`inline-flex rounded-[5px] px-1.5 py-0.5 font-mono text-[9.5px] font-semibold ${bdg}`}>
                {stxt}
              </span>
            </div>
          </div>
        </div>

        {/* Section header + scenario controls */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b pb-2" style={{ borderColor: '#e2e6ed' }}>
          <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">
            Deal parameters
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {!scenarioMode && (
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={handleChangeScenario}>
                Change scenario
              </Button>
            )}
            {scenarioMode && (
              <>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={calculating || !draftValid}
                  onClick={() => void handleCalculate()}
                >
                  {calculating ? 'Calculating…' : 'Calculate'}
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={handleCancelScenario}>
                  Cancel
                </Button>
              </>
            )}
            {scenarioActive && !scenarioMode && (
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={handleResetToBase}>
                Reset to base
              </Button>
            )}
          </div>
        </div>

        {savedScenarios.length > 0 && (
          <div className="mb-4">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              <TabsList className="h-auto flex-wrap">
                <TabsTrigger value="base" className="text-xs">
                  Base
                </TabsTrigger>
                {savedScenarios.map((s, i) => (
                  <TabsTrigger key={s.id} value={s.id} className="text-xs">
                    Scenario {i + 1}
                  </TabsTrigger>
                ))}
              </TabsList>
              <TabsContent value="base">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Base case</CardTitle>
                    <CardDescription>
                      {fP(d.rate)} · IO {d.io}mo · {d.tenure}mo tenure
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    Original deal terms. IRR and schedule reflect the loaded portfolio data.
                  </CardContent>
                </Card>
              </TabsContent>
              {savedScenarios.map((s) => {
                const irr = s.metrics?.ann_irr
                const moic = s.metrics?.moic
                return (
                  <TabsContent key={s.id} value={s.id}>
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">{s.label}</CardTitle>
                        <CardDescription>
                          IRR {irr ? fPct1(irr) : 'N/A'}
                          {moic ? ` · MOIC ${moic.toFixed(2)}x` : ''}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="text-sm text-muted-foreground">
                        Rate {s.draft.ratePct}% · IO {s.draft.io}mo · Amort {s.draft.amort}mo · Tenure{' '}
                        {s.draft.tenure}mo
                      </CardContent>
                    </Card>
                  </TabsContent>
                )
              })}
            </Tabs>
          </div>
        )}

        {/* Params grid */}
        <div className="mb-5 grid grid-cols-5 gap-1.5">
          <ParamCellShell label="Principal">
            <div className="text-[13px] font-medium text-[#1e3f7a]">{fD(d.principal)}</div>
          </ParamCellShell>
          <ParamCellShell label="Outstanding">
            <div className="text-[13px] font-medium text-[#0d1117]">{fD(calculatedOutstanding)}</div>
          </ParamCellShell>
          <ParamCell
            label="Rate"
            field="ratePct"
            scenarioMode={scenarioMode}
            draft={draft}
            fieldErrors={fieldErrors}
            onDraftChange={handleDraftChange}
            display={fP(scenarioActive ? parseFloat(draft.ratePct) / 100 || d.rate : d.rate)}
          />
          <ParamCellShell label="IRR">
            <button
              type="button"
              className="text-left text-[13px] font-medium text-[#1e3f7a] underline decoration-dotted underline-offset-2 hover:text-[#0f2044]"
              onClick={() => onIrrClick(scenarioActive ? activeDeal : d)}
            >
              {irrStr} ℹ
            </button>
          </ParamCellShell>
          <ParamCell
            label="IO months"
            field="io"
            scenarioMode={scenarioMode}
            draft={draft}
            fieldErrors={fieldErrors}
            onDraftChange={handleDraftChange}
            display={String(scenarioActive ? displayIo : d.io)}
          />
          <ParamCell
            label="Amort months"
            field="amort"
            scenarioMode={scenarioMode}
            draft={draft}
            fieldErrors={fieldErrors}
            onDraftChange={handleDraftChange}
            display={String(scenarioActive ? displayAmort : d.amort)}
          />
          <ParamCell
            label="Tenure"
            field="tenure"
            scenarioMode={scenarioMode}
            draft={draft}
            fieldErrors={fieldErrors}
            onDraftChange={handleDraftChange}
            display={`${scenarioActive ? draft.tenure : d.tenure}mo`}
          />
          <ParamCellShell label="Orig fee">
            <div className="text-[13px] font-medium text-[#0d1117]">{fP(d.orig_fee)}</div>
          </ParamCellShell>
          <ParamCellShell label="EOT fee">
            <div className="text-[13px] font-medium text-[#0d1117]">{fP(d.eot_fee)}</div>
          </ParamCellShell>
          <ParamCellShell label="MOIC">
            <div className="text-[13px] font-medium text-emerald-700">
              {moicVal ? `${moicVal.toFixed(2)}x` : '—'}
            </div>
          </ParamCellShell>
          {d.pik_rate ? (
            <ParamCellShell label="PIK">
              <div className="text-[13px] font-medium text-amber-700">{fP(d.pik_rate)}</div>
            </ParamCellShell>
          ) : null}
        </div>

        {/* Schedule header */}
        <div className="mb-2 flex flex-wrap items-center gap-2 border-b pb-2" style={{ borderColor: '#e2e6ed' }}>
          <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">
            Monthly payment schedule
          </span>
          <span className="rounded-[5px] border border-[#cddaf4] bg-[#eaf0fb] px-2 py-0.5 font-mono text-[9.5px] text-[#1e3f7a]">
            {scheduleBadge}
          </span>
        </div>

        {/* Summary badges */}
        <div className="mb-2 flex gap-2">
          <span className="rounded-[5px] bg-[#d1fae5] px-2 py-0.5 font-mono text-[11px] text-[#065f46]">
            ✓ {paidCnt} paid
          </span>
          <span className="rounded-[5px] bg-[#eaf0fb] px-2 py-0.5 font-mono text-[11px] text-[#1e3f7a]">
            ⏳ {pendCnt} pending
          </span>
        </div>

        {/* Legend */}
        <div className="mb-2 flex flex-wrap gap-3">
          {[
            { color: '#d1fae5', border: '#10b981', label: 'Paid' },
            { color: '#eff6ff', border: '#4f9cf9', label: 'Current' },
            { color: '#fff', border: '#e2e6ed', label: 'Pending' },
          ].map(({ color, border, label }) => (
            <div key={label} className="flex items-center gap-1 text-[10.5px] text-[#4b5563]">
              <div
                className="h-3.5 w-3.5 rounded-[2px] border-l-[3px]"
                style={{ background: color, borderLeftColor: border }}
              />
              {label}
            </div>
          ))}
        </div>

        {/* Table */}
        <div ref={schedRef} className="mb-4 max-h-[300px] overflow-y-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow className="sticky top-0 z-10 bg-primary hover:bg-primary [&>th]:text-primary-foreground">
                {[
                  'Mo.',
                  'Date',
                  'Phase',
                  'Opening bal.',
                  'Interest',
                  'Principal',
                  'EOT fee',
                  'Total payment',
                  'Closing bal.',
                ].map((h) => (
                  <TableHead key={h} className="whitespace-nowrap font-mono text-[9.5px] font-medium tracking-wide">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className="font-mono text-[11px]">
              {scheduleRows.map((r) => {
                const dateStr =
                  typeof r.date === 'string'
                    ? fDate(new Date(r.date)) + (r.status === 'today' ? ' ◀' : '')
                    : fDate(r.date as unknown as Date) + (r.status === 'today' ? ' ◀' : '')
                return (
                  <TableRow key={r.m} id={`sr-${r.m}`} className={`row-${r.status}`}>
                    <TableCell>{r.m}</TableCell>
                    <TableCell>{dateStr}</TableCell>
                    <TableCell>{r.phase}</TableCell>
                    <TableCell>{fD(r.open_bal)}</TableCell>
                    <TableCell>{fD(r.interest)}</TableCell>
                    <TableCell>{r.prin > 0 ? fD(r.prin) : '—'}</TableCell>
                    <TableCell>{r.eot > 0 ? fD(r.eot) : '—'}</TableCell>
                    <TableCell className="font-semibold">{fD(r.total)}</TableCell>
                    <TableCell>{fD(r.close_bal)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        <p className="text-[11px] text-[#9ca3af]">Use analysis tools below for Claude AI-powered deep dives</p>
      </div>

      {/* Bottom toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border bg-card px-4 py-2.5 sm:px-5">
        <span className="mr-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Analysis</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="gap-1 font-normal">
              Run analysis
              <ChevronDown className="h-3.5 w-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Claude tools</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {TOOL_BUTTONS.map(({ id, label }) => (
              <DropdownMenuItem key={id} onClick={() => onTool(id, autoToolPrompt(id))}>
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
