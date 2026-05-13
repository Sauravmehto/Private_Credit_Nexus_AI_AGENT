import type { Deal } from '../../dealTypes'
import { getInstrumentConfig } from '../../dealTypes'
import { dealIRR } from '../../utils/irrMath'
import type { PortfolioSummaryResponse } from '../../types'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts'

const PAL = ['#1e3f7a','#2756a3','#3d72c8','#6696db','#9bbae8','#cddaf4','#10b981','#f59e0b','#ef4444','#7c3aed','#0891b2']

interface Props {
  deals: Deal[]
  backendSummary: PortfolioSummaryResponse | null
}

function ChartCard({ title, children, full }: { title: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`rounded-[11px] border bg-white p-4 ${full ? 'col-span-2' : ''}`} style={{ borderColor: '#e2e6ed' }}>
      <div className="mb-3 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">{title}</div>
      {children}
    </div>
  )
}

export function ChartsView({ deals, backendSummary }: Props) {
  if (!deals.length) {
    return <div className="flex h-full items-center justify-center text-[13px] text-[#9ca3af]">Load portfolio data to view charts.</div>
  }

  // Build backend IRR lookup map
  const dealIRRMap: Record<string, number> = {}
  if (backendSummary) {
    for (const di of backendSummary.deal_irrs) {
      dealIRRMap[di.deal_id] = di.ann_irr
    }
  }

  // IRR per deal — use backend value when available, fall back to browser
  const irrData = deals.map((d) => {
    const browserIRR = dealIRR(d)?.annIRR ?? 0
    const ann = dealIRRMap[d.id] ?? browserIRR
    const irrPct = parseFloat((ann * 100).toFixed(1))
    return {
      name: d.name.length > 14 ? d.name.slice(0, 13) + '…' : d.name,
      irr: irrPct,
    }
  })

  // Allocation
  const allocData = deals.map((d, i) => ({
    name: d.name.length > 12 ? d.name.slice(0, 11) + '…' : d.name,
    value: Math.round(d.principal),
    fill: PAL[i % PAL.length],
  }))

  // Cash flow waterfall (first 6 deals, 12 months monthly interest)
  const cfMonths = Array.from({ length: 12 }, (_, i) => {
    const entry: Record<string, string | number> = { month: `Mo.${i + 1}` }
    deals.slice(0, 6).forEach((d) => {
      let bal = d.principal
      const mr = d.rate / 12
      const mp = d.amort > 0 ? d.principal / d.amort : 0
      for (let m = 1; m <= i + 1; m++) {
        const pr = m <= d.io ? 0 : mp
        bal -= pr
        if (bal < 0) bal = 0
      }
      const interest = bal * mr
      entry[d.name.length > 10 ? d.name.slice(0, 9) + '…' : d.name] = parseFloat(interest.toFixed(0))
    })
    return entry
  })
  const cfKeys = deals.slice(0, 6).map((d) => d.name.length > 10 ? d.name.slice(0, 9) + '…' : d.name)

  // Instrument bar
  const instMap: Record<string, number> = {}
  deals.forEach((d) => {
    const l = getInstrumentConfig(d).l
    instMap[l] = (instMap[l] || 0) + d.principal
  })
  const instData = Object.entries(instMap).map(([name, value], i) => ({ name, value: Math.round(value), fill: PAL[i % PAL.length] }))

  // Covenant doughnut
  const nCC = deals.filter((d) => d.status === 'compliant').length
  const nM  = deals.filter((d) => d.status === 'monitoring').length
  const nB  = deals.filter((d) => d.status === 'breach risk').length
  const covData = [
    { name: `Compliant (${nCC})`, value: nCC, fill: '#10b981' },
    { name: `Monitoring (${nM})`, value: nM, fill: '#f59e0b' },
    { name: `Breach (${nB})`, value: nB, fill: '#ef4444' },
  ]

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-5">
        <div className="mb-0.5 text-[18px] font-semibold tracking-tight text-[#0d1117]">Portfolio charts</div>
        <div className="mb-4 font-mono text-[11.5px] text-[#9ca3af]">Visual analytics across {deals.length} deals</div>

        <div className="grid grid-cols-2 gap-3">
          {/* IRR bar */}
          <ChartCard title="IRR per deal">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={irrData} margin={{ top: 4, right: 4, bottom: 28, left: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} angle={-35} textAnchor="end" interval={0} />
                <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <Tooltip formatter={(v: unknown) => [`${v}%`, 'EIR']} />
                <Bar dataKey="irr" radius={[3, 3, 0, 0]} label={false}>
                  {irrData.map((entry, i) => (
                    <Cell key={i} fill={entry.irr >= 18 ? '#065f46' : entry.irr >= 14 ? '#1e3f7a' : '#92400e'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Allocation doughnut */}
          <ChartCard title="Portfolio allocation by principal">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={allocData} dataKey="value" innerRadius={60} outerRadius={90} paddingAngle={2}>
                  {allocData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip formatter={(v: unknown) => [`$${Number(v).toLocaleString()}`, '']} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Cash flow waterfall */}
          <ChartCard title="Cash flow waterfall — monthly interest income" full>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={cfMonths} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <YAxis tickFormatter={(v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <Tooltip formatter={(v: unknown) => [`$${Number(v).toLocaleString()}`, '']} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                {cfKeys.map((k, i) => (
                  <Bar key={k} dataKey={k} stackId="a" fill={PAL[i % PAL.length]} radius={i === cfKeys.length - 1 ? [2, 2, 0, 0] : [0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Instrument bar */}
          <ChartCard title="Principal by instrument type">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={instData} layout="vertical" margin={{ top: 4, right: 4, bottom: 4, left: 40 }}>
                <XAxis type="number" tickFormatter={(v) => v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${(v / 1e3).toFixed(0)}K`} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} width={80} />
                <Tooltip formatter={(v: unknown) => [`$${Number(v).toLocaleString()}`, 'Principal']} />
                <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                  {instData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Covenant doughnut */}
          <ChartCard title="Covenant status distribution">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={covData} dataKey="value" innerRadius={55} outerRadius={80} paddingAngle={2}>
                  {covData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                </Pie>
                <Tooltip />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>
    </div>
  )
}
