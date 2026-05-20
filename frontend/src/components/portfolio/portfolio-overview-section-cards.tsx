import type { ReactNode } from 'react'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export type PortfolioOverviewSectionCardsProps = {
  aumLabel: string
  dealCount: number
  instrumentTypeCount: number
  avgDealLabel: string
  wtdRateLabel: string
  portfolioIrrLabel: string
  portfolioIrrSub: string
  summaryLoading: boolean
  hasBackendSummary: boolean
  breachCount: number
  breachPct: number
  compliantCount: number
  onPortfolioIrrClick: () => void
}

const stripCard =
  'min-w-0 overflow-hidden border bg-gradient-to-b from-primary/[0.06] to-card shadow-sm'

const kpiLabel = 'text-[10px] font-medium uppercase tracking-wide text-muted-foreground'
const kpiValue = 'truncate text-base font-semibold tabular-nums leading-tight sm:text-lg'
const kpiHint = 'line-clamp-1 text-[10px] leading-tight text-muted-foreground'

function CornerBadge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Badge variant="outline" className={cn('h-5 shrink-0 gap-0.5 rounded-md px-1.5 py-0 text-[10px] font-medium leading-none', className)}>
      {children}
    </Badge>
  )
}

export function PortfolioOverviewSectionCards({
  aumLabel,
  dealCount,
  instrumentTypeCount,
  avgDealLabel,
  wtdRateLabel,
  portfolioIrrLabel,
  portfolioIrrSub,
  summaryLoading,
  hasBackendSummary,
  breachCount,
  breachPct,
  compliantCount,
  onPortfolioIrrClick,
}: PortfolioOverviewSectionCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2 sm:items-stretch">
      <Card data-slot="card" className={stripCard}>
        <div className="flex flex-col gap-1.5 p-3 sm:p-2.5 sm:py-2">
          <div className="flex items-start justify-between gap-1.5">
            <span className={kpiLabel}>AUM</span>
            <CornerBadge>
              <TrendingUp className="size-2.5 opacity-80" aria-hidden />
              {dealCount}
            </CornerBadge>
          </div>
          <div className={kpiValue}>{aumLabel}</div>
          <p className={kpiHint}>{instrumentTypeCount} instrument types</p>
        </div>
      </Card>

      <Card data-slot="card" className={stripCard}>
        <div className="flex flex-col gap-1.5 p-3 sm:p-2.5 sm:py-2">
          <div className="flex items-start justify-between gap-1.5">
            <span className={kpiLabel}>Avg · Wtd</span>
            <CornerBadge className="font-mono">{wtdRateLabel}</CornerBadge>
          </div>
          <div className={kpiValue}>{avgDealLabel}</div>
          <p className={kpiHint}>Weighted cash coupon</p>
        </div>
      </Card>

      <Card
        data-slot="card"
        className={cn(stripCard, 'cursor-pointer transition-colors hover:bg-muted/25', summaryLoading && 'pointer-events-none')}
        onClick={() => {
          if (!summaryLoading) onPortfolioIrrClick()
        }}
      >
        <div className="flex flex-col gap-1.5 p-3 sm:p-2.5 sm:py-2">
          <div className="flex items-start justify-between gap-1.5">
            <span className={kpiLabel}>Port. IRR</span>
            <CornerBadge>
              {hasBackendSummary ? <TrendingUp className="size-2.5 opacity-80" aria-hidden /> : <TrendingDown className="size-2.5 opacity-50" aria-hidden />}
              {hasBackendSummary ? 'API' : 'Local'}
            </CornerBadge>
          </div>
          {summaryLoading ? (
            <Skeleton className="h-6 w-20 sm:h-5" />
          ) : (
            <div className={cn(kpiValue, 'text-primary underline decoration-dotted underline-offset-2')}>{portfolioIrrLabel}</div>
          )}
          <p className={kpiHint}>{summaryLoading ? 'Loading…' : portfolioIrrSub}</p>
        </div>
      </Card>

      <Card data-slot="card" className={stripCard}>
        <div className="flex flex-col gap-1.5 p-3 sm:p-2.5 sm:py-2">
          <div className="flex items-start justify-between gap-1.5">
            <span className={kpiLabel}>Breach</span>
            <CornerBadge className={breachCount > 0 ? 'border-destructive/40 text-destructive' : ''}>
              {breachCount > 0 ? <TrendingDown className="size-2.5" aria-hidden /> : <TrendingUp className="size-2.5 text-emerald-600" aria-hidden />}
              {breachPct}%
            </CornerBadge>
          </div>
          <div className={kpiValue}>{breachCount}</div>
          <p className={kpiHint}>
            {compliantCount}/{dealCount} compliant
          </p>
        </div>
      </Card>
    </div>
  )
}
