import type { Deal } from '@/dealTypes'
import { getInstrumentConfig } from '@/dealTypes'
import { portfolioIRR } from '@/utils/irrMath'
import { fD, fP, fPct1 } from '@/utils/formatters'
import type { PortfolioSummaryResponse } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PortfolioDealsTable } from '@/components/portfolio/portfolio-deals-table'
import { PortfolioOverviewSectionCards } from '@/components/portfolio/portfolio-overview-section-cards'
import { PortfolioPrincipalChart } from '@/components/portfolio/portfolio-principal-chart'

interface Props {
  deals: Deal[]
  backendSummary: PortfolioSummaryResponse | null
  summaryLoading: boolean
  onDealSelect: (id: string) => void
  onIrrClick: (deal: Deal | null) => void
  onAIAnalysis: () => void
}

export function PortfolioView({ deals, backendSummary, summaryLoading, onDealSelect, onIrrClick, onAIAnalysis }: Props) {
  if (!deals.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-10 text-center">
        <div className="mb-4 text-5xl">📂</div>
        <div className="mb-2 text-lg font-semibold text-foreground">No portfolio data</div>
        <div className="mb-5 text-sm text-muted-foreground">Upload your portfolio file to get started.</div>
      </div>
    )
  }

  const aum = deals.reduce((s, d) => s + (d.principal || 0), 0)
  const nCC = deals.filter((d) => d.status === 'compliant').length
  const nM = deals.filter((d) => d.status === 'monitoring').length
  const nB = deals.filter((d) => d.status === 'breach risk').length
  const avgDeal = deals.length ? aum / deals.length : 0
  const wtdRate = aum > 0 ? deals.reduce((s, d) => s + d.rate * (d.principal / (aum || 1)), 0) : 0

  const portIRRBrowser = portfolioIRR(deals)
  const portIRRVal = backendSummary ? backendSummary.port_irr : portIRRBrowser

  const dealIRRMap: Record<string, number> = {}
  if (backendSummary) {
    for (const di of backendSummary.deal_irrs) {
      dealIRRMap[di.deal_id] = di.ann_irr
    }
  }

  const rp = deals.length ? Math.round((nB / deals.length) * 100) : 0
  const cp = deals.length ? Math.round((nCC / deals.length) * 100) : 0
  const mp = deals.length ? Math.round((nM / deals.length) * 100) : 0

  const instMap: Record<string, number> = {}
  deals.forEach((d) => {
    const l = getInstrumentConfig(d).l
    instMap[l] = (instMap[l] || 0) + 1
  })

  const instrumentTypeCount = Object.keys(instMap).length

  return (
    <div className="h-full overflow-y-auto">
      <div className="@container/main flex flex-col gap-6 px-4 py-5 lg:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">Portfolio overview</h1>
            <p className="mt-1 font-mono text-[11.5px] text-muted-foreground">
              {deals.length} deals · {Object.keys(instMap).join(', ')}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" className="text-xs shrink-0" onClick={onAIAnalysis}>
            AI analysis
          </Button>
        </div>

        <PortfolioOverviewSectionCards
          aumLabel={fD(aum)}
          dealCount={deals.length}
          instrumentTypeCount={instrumentTypeCount}
          avgDealLabel={fD(avgDeal)}
          wtdRateLabel={fP(wtdRate)}
          portfolioIrrLabel={summaryLoading ? '…' : portIRRVal ? fPct1(portIRRVal) : 'N/A'}
          portfolioIrrSub={backendSummary ? 'AI-computed IRR' : 'Browser weighted average'}
          summaryLoading={summaryLoading}
          hasBackendSummary={!!backendSummary}
          breachCount={nB}
          breachPct={rp}
          compliantCount={nCC}
          onPortfolioIrrClick={() => onIrrClick(null)}
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="font-mono text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Deal health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex h-1.5 overflow-hidden rounded-md bg-muted">
                <div className="h-full rounded-l bg-emerald-500" style={{ width: `${cp}%` }} />
                <div className="h-full bg-amber-400" style={{ width: `${mp}%` }} />
                <div className="h-full rounded-r bg-rose-500" style={{ width: `${rp}%` }} />
              </div>
              <div className="flex flex-wrap gap-3">
                {[
                  { color: '#10b981', label: `${nCC} Compliant` },
                  { color: '#f59e0b', label: `${nM} Monitoring` },
                  { color: '#ef4444', label: `${nB} Breach risk` },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <div className="h-1.5 w-1.5 rounded-sm" style={{ background: color }} />
                    {label}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="font-mono text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Instrument mix</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {Object.entries(instMap).map(([k, v]) => (
                  <div key={k} className="rounded-md border border-border bg-muted/40 px-2 py-1.5">
                    <div className="font-mono text-[9.5px] text-muted-foreground">{k}</div>
                    <div className="text-sm font-medium text-foreground">{v}</div>
                    <div className="text-[9.5px] text-emerald-600">{Math.round((v / deals.length) * 100)}%</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <PortfolioPrincipalChart deals={deals} />

        <PortfolioDealsTable
          deals={deals}
          dealIRRMap={dealIRRMap}
          summaryLoading={summaryLoading}
          onDealSelect={onDealSelect}
          onIrrClick={onIrrClick}
        />
      </div>
    </div>
  )
}
