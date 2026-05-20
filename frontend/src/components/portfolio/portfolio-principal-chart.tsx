import { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import type { Deal } from '@/dealTypes'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'

const chartConfig = {
  principal: {
    label: 'Principal ($M)',
    color: 'hsl(var(--primary))',
  },
} satisfies ChartConfig

function shortDealName(name: string, max = 14) {
  const t = name.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

export function PortfolioPrincipalChart({ deals }: { deals: Deal[] }) {
  const data = useMemo(() => {
    const sorted = [...deals].sort((a, b) => b.principal - a.principal).slice(0, 12)
    return sorted.map((d) => ({
      deal: shortDealName(d.name),
      principal: Math.round((d.principal / 1_000_000) * 100) / 100,
    }))
  }, [deals])

  if (data.length === 0) {
    return null
  }

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Principal concentration</CardTitle>
        <CardDescription>Top deals by outstanding principal (millions).</CardDescription>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full">
          <AreaChart data={data} margin={{ left: 0, right: 12, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="fillPrincipal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-principal)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-principal)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="deal" tickLine={false} axisLine={false} tickMargin={8} interval={0} angle={-35} textAnchor="end" height={56} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} width={44} tickFormatter={(v) => `$${v}`} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
            <Area dataKey="principal" type="monotone" fill="url(#fillPrincipal)" stroke="var(--color-principal)" strokeWidth={2} />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
