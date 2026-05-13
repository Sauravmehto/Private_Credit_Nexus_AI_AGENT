import { useEffect, useState } from 'react'
import type { Deal, ScenarioInput } from '../../dealTypes'
import { dealIRR } from '../../utils/irrMath'
import { fD, fP, fPct1 } from '../../utils/formatters'
import { getScenarios } from '../../api'
import type { ScenarioResult } from '../../types'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'

interface Props {
  deals: Deal[]
  onAIAnalysis: (prompt: string) => void
}

type BadgeType = 'base' | 'best' | 'worst' | 'cust'

function buildPresets(d: Deal): ScenarioInput[] {
  return [
    { id: 'base',     label: 'Base case',          badge: 'base',  rate: d.rate,               tenure: d.tenure,      io: d.io, origFee: d.orig_fee,         eotFee: d.eot_fee,         pik: d.pik_rate || 0 },
    { id: 'ext6',     label: 'Maturity +6mo',       badge: 'cust',  rate: d.rate,               tenure: d.tenure + 6,  io: d.io, origFee: d.orig_fee,         eotFee: d.eot_fee,         pik: d.pik_rate || 0 },
    { id: 'rateup',   label: 'Rate +150bps',         badge: 'best',  rate: d.rate + 0.015,       tenure: d.tenure,      io: d.io, origFee: d.orig_fee,         eotFee: d.eot_fee,         pik: d.pik_rate || 0 },
    { id: 'pik',      label: 'PIK +5% toggle',       badge: 'cust',  rate: d.rate,               tenure: d.tenure,      io: d.io, origFee: d.orig_fee,         eotFee: d.eot_fee,         pik: (d.pik_rate || 0) + 0.05 },
    { id: 'ratedn',   label: 'Rate -100bps',         badge: 'worst', rate: Math.max(d.rate - 0.01, 0.04), tenure: d.tenure, io: d.io, origFee: d.orig_fee, eotFee: d.eot_fee,            pik: d.pik_rate || 0 },
    { id: 'ext12',    label: 'Maturity +12mo',       badge: 'cust',  rate: d.rate,               tenure: d.tenure + 12, io: d.io, origFee: d.orig_fee,         eotFee: d.eot_fee + 0.01,  pik: d.pik_rate || 0 },
    { id: 'covwv',    label: 'Cov waiver +2%',       badge: 'cust',  rate: d.rate + 0.02,         tenure: d.tenure,      io: d.io, origFee: d.orig_fee + 0.015, eotFee: d.eot_fee,         pik: d.pik_rate || 0 },
    { id: 'distress', label: 'Distressed restr.',    badge: 'worst', rate: d.rate - 0.02,         tenure: d.tenure + 18, io: d.tenure + 6, origFee: d.orig_fee, eotFee: d.eot_fee + 0.02, pik: (d.pik_rate || 0) + 0.03 },
  ]
}

function scIRR(d: Deal, sc: ScenarioInput): number {
  const dd: Deal = { ...d, rate: sc.rate, tenure: sc.tenure, io: sc.io, amort: d.amort === 0 ? 0 : sc.tenure - sc.io, orig_fee: sc.origFee, eot_fee: sc.eotFee, pik_rate: sc.pik }
  const r = dealIRR(dd)
  return r ? r.annIRR : 0
}

const BADGE_STYLES: Record<BadgeType, { card: string; badge: string }> = {
  base:  { card: 'border-[#9bbae8] bg-[#eaf0fb]',  badge: 'bg-[#cddaf4] text-[#162d5e]' },
  best:  { card: 'border-[#a7f3d0] bg-emerald-50',  badge: 'bg-[#a7f3d0] text-[#065f46]' },
  worst: { card: 'border-[#fecaca] bg-rose-50',     badge: 'bg-[#fecaca] text-[#991b1b]' },
  cust:  { card: 'border-[#fde68a] bg-amber-50',   badge: 'bg-amber-100 text-amber-700' },
}

export function ScenarioView({ deals, onAIAnalysis }: Props) {
  const [selectedId, setSelectedId] = useState(deals[0]?.id ?? '')
  const [backendScenarios, setBackendScenarios] = useState<ScenarioResult[] | null>(null)
  const [_scenariosLoading, setScenariosLoading] = useState(false)

  const d = deals.find((x) => x.id === selectedId) ?? deals[0]

  useEffect(() => {
    if (!d) return
    const ctrl = new AbortController()
    setScenariosLoading(true)
    setBackendScenarios(null)
    getScenarios(d, undefined, ctrl.signal)
      .then(setBackendScenarios)
      .catch(() => {/* keep browser fallback */})
      .finally(() => setScenariosLoading(false))
    return () => ctrl.abort()
  }, [d?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!deals.length || !d) {
    return <div className="flex h-full items-center justify-center text-[13px] text-[#9ca3af]">Load portfolio data first.</div>
  }

  const presets = buildPresets(d)
  const browserBaseIRR = scIRR(d, presets[0])
  const baseIRR = backendScenarios?.[0]?.ann_irr ?? browserBaseIRR

  // Merge backend and browser: use backend if available
  const scenarioIRRs = backendScenarios
    ? backendScenarios.slice(0, 8).map((bs) => ({
        sc: {
          id: bs.id, label: bs.label, badge: bs.badge as ScenarioInput['badge'],
          rate: bs.rate, tenure: bs.tenure, io: bs.io,
          origFee: bs.orig_fee, eotFee: bs.eot_fee, pik: bs.pik,
        } as ScenarioInput,
        irr: bs.ann_irr,
      }))
    : presets.map((sc) => ({ sc, irr: scIRR(d, sc) }))

  const chartData = scenarioIRRs.map(({ sc, irr }) => ({
    name: sc.label,
    irr: parseFloat((irr * 100).toFixed(2)),
    fill: sc.id === 'base' ? '#1e3f7a' : irr > baseIRR ? '#065f46' : '#991b1b',
  }))

  // custom inputs
  const [customRate, setCustomRate] = useState((d.rate * 100).toFixed(2))
  const [customTenure, setCustomTenure] = useState(String(d.tenure))
  const [customIO, setCustomIO] = useState(String(d.io))
  const [customOrigFee, setCustomOrigFee] = useState((d.orig_fee * 100).toFixed(2))
  const [customEotFee, setCustomEotFee] = useState((d.eot_fee * 100).toFixed(2))
  const [customPik, setCustomPik] = useState(((d.pik_rate || 0) * 100).toFixed(2))
  const [customResult, setCustomResult] = useState<string | null>(null)
  const [customLoading, setCustomLoading] = useState(false)

  useEffect(() => {
    setCustomRate((d.rate * 100).toFixed(2))
    setCustomTenure(String(d.tenure))
    setCustomIO(String(d.io))
    setCustomOrigFee((d.orig_fee * 100).toFixed(2))
    setCustomEotFee((d.eot_fee * 100).toFixed(2))
    setCustomPik(((d.pik_rate || 0) * 100).toFixed(2))
    setCustomResult(null)
  }, [d.id, d.rate, d.tenure, d.io, d.orig_fee, d.eot_fee, d.pik_rate])

  function calcCustom() {
    const sc: ScenarioInput = {
      id: 'custom', label: 'Custom', badge: 'cust',
      rate: parseFloat(customRate) / 100,
      tenure: parseInt(customTenure),
      io: parseInt(customIO),
      origFee: parseFloat(customOrigFee) / 100,
      eotFee: parseFloat(customEotFee) / 100,
      pik: parseFloat(customPik) / 100,
    }
    // Show browser result instantly
    const browserIrr = scIRR(d, sc)
    const delta0 = browserIrr - baseIRR
    setCustomResult(`EIR: ${fPct1(browserIrr)} (${delta0 >= 0 ? '+' : ''}${fPct1(delta0)} vs base)`)
    // Then fetch backend result
    setCustomLoading(true)
    getScenarios(d, {
      rate: sc.rate, tenure: sc.tenure, io: sc.io,
      orig_fee: sc.origFee, eot_fee: sc.eotFee, pik_rate: sc.pik,
    }).then((results) => {
      const custom = results.find(r => r.id === 'custom')
      if (custom) {
        const delta = custom.ann_irr - baseIRR
        setCustomResult(`EIR: ${fPct1(custom.ann_irr)} (${delta >= 0 ? '+' : ''}${fPct1(delta)} vs base)`)
      }
    }).catch(() => {/* keep browser result */}).finally(() => setCustomLoading(false))
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-6 py-5">
        <div className="mb-0.5 text-[18px] font-semibold tracking-tight text-[#0d1117]">Scenario comparison</div>
        <div className="mb-4 font-mono text-[11.5px] text-[#9ca3af]">Side-by-side IRR view across restructure options</div>

        {/* Controls */}
        <div className="mb-3 rounded-[11px] border bg-white p-4" style={{ borderColor: '#e2e6ed' }}>
          <div className="mb-3 flex items-center gap-3">
            <span className="text-[12px] font-medium text-[#0d1117]">Deal:</span>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="rounded-[5px] border px-2 py-1 text-[12px] text-[#0d1117] outline-none"
              style={{ borderColor: '#d0d5df', background: '#f7f8fa' }}
            >
              {deals.map((dd) => <option key={dd.id} value={dd.id}>{dd.name}</option>)}
            </select>
            <span className="font-mono text-[11px] text-[#9ca3af]">
              Base EIR: <strong className="text-[#1e3f7a]">{fPct1(baseIRR)}</strong>
              &nbsp;·&nbsp; Principal: <strong>{fD(d.principal)}</strong>
              &nbsp;·&nbsp; Tenure: <strong>{d.tenure}mo</strong>
            </span>
          </div>

          <div className="mb-2 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">Custom scenario</div>
          <div className="mb-2 grid grid-cols-4 gap-2">
            {[
              { l: 'Rate (%)',      val: customRate,    set: setCustomRate },
              { l: 'Tenure (mo)',   val: customTenure,  set: setCustomTenure },
              { l: 'Orig fee (%)',  val: customOrigFee, set: setCustomOrigFee },
              { l: 'EOT fee (%)',   val: customEotFee,  set: setCustomEotFee },
            ].map(({ l, val, set }) => (
              <div key={l} className="flex flex-col gap-1">
                <label className="font-mono text-[10.5px] uppercase tracking-[0.05em] text-[#9ca3af]">{l}</label>
                <input
                  type="number" step="0.1" value={val}
                  onChange={(e) => set(e.target.value)}
                  className="rounded-[5px] border px-2.5 py-1.5 font-mono text-[12.5px] text-[#0d1117] outline-none transition-colors focus:border-[#3d72c8] focus:bg-white"
                  style={{ borderColor: '#d0d5df', background: '#f7f8fa', width: '100%' }}
                />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { l: 'IO months',    val: customIO,  set: setCustomIO },
              { l: 'PIK rate (%)', val: customPik, set: setCustomPik },
            ].map(({ l, val, set }) => (
              <div key={l} className="flex flex-col gap-1">
                <label className="font-mono text-[10.5px] uppercase tracking-[0.05em] text-[#9ca3af]">{l}</label>
                <input
                  type="number" step="0.1" value={val}
                  onChange={(e) => set(e.target.value)}
                  className="rounded-[5px] border px-2.5 py-1.5 font-mono text-[12.5px] text-[#0d1117] outline-none transition-colors focus:border-[#3d72c8] focus:bg-white"
                  style={{ borderColor: '#d0d5df', background: '#f7f8fa', width: '100%' }}
                />
              </div>
            ))}
            <div className="col-span-2 flex items-end justify-end gap-2">
              <button type="button" onClick={calcCustom} disabled={customLoading}
                className="rounded-[5px] bg-[#162d5e] px-3 py-1.5 text-[11.5px] font-medium text-white hover:bg-[#0f2044] disabled:opacity-70">
                {customLoading ? 'Computing…' : 'Calculate'}
              </button>
              <button type="button" onClick={() => onAIAnalysis(`Analyse restructure scenarios for ${d.name} (${d.instrument_type}, ${fD(d.principal)} at ${fP(d.rate)}, IO ${d.io}mo, tenure ${d.tenure}mo). Compare base case, maturity extension +6mo, rate step-up +150bps, covenant waiver with 2% fee, distressed restructure. For each: EIR change in bps, MOIC impact, recommendation.`)}
                className="rounded-[5px] border px-3 py-1.5 text-[11.5px] text-[#4b5563] hover:border-[#9bbae8] hover:text-[#1e3f7a]"
                style={{ borderColor: '#d0d5df', background: '#f7f8fa' }}>
                ▶ Ask Claude AI
              </button>
            </div>
          </div>
          {customResult && (
            <div className="mt-2 rounded-[5px] border border-[#cddaf4] bg-[#eaf0fb] px-3 py-2 font-mono text-[11.5px] text-[#1e3f7a]">
              {customResult}
            </div>
          )}
        </div>

        {/* Cards */}
        <div className="mb-3 grid grid-cols-4 gap-2.5">
          {scenarioIRRs.map(({ sc, irr }) => {
            const delta = irr - baseIRR
            const styles = BADGE_STYLES[sc.badge]
            const irrCls = irr > baseIRR ? 'text-emerald-700' : irr < baseIRR ? 'text-rose-700' : 'text-[#1e3f7a]'
            const deltaCls = delta > 0.001 ? 'text-emerald-700' : delta < -0.001 ? 'text-rose-700' : 'text-[#9ca3af]'
            return (
              <div key={sc.id} className={`rounded-[11px] border p-4 ${styles.card}`}>
                <span className={`mb-2 inline-block rounded-[4px] px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] ${styles.badge}`}>
                  {sc.label}
                </span>
                <div className={`text-[24px] font-bold ${irrCls}`}>{fPct1(irr)}</div>
                <div className={`mb-2 font-mono text-[11px] ${deltaCls}`}>{delta >= 0 ? '+' : ''}{fPct1(delta)} vs base</div>
                <div className="font-mono text-[11px] text-[#4b5563]">
                  {[
                    ['Rate', fP(sc.rate)],
                    ['Tenure', `${sc.tenure}mo`],
                    ['IO', `${sc.io}mo`],
                    ['Orig', fP(sc.origFee)],
                    ['EOT', fP(sc.eotFee)],
                    ...(sc.pik ? [['PIK', fP(sc.pik)]] : []),
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-black/5 py-0.5 last:border-0">
                      <span>{k}</span><span className="font-medium text-[#0d1117]">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Chart */}
        <div className="rounded-[11px] border bg-white p-4" style={{ borderColor: '#e2e6ed' }}>
          <div className="mb-3 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[#9ca3af]">IRR comparison across scenarios</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <YAxis tickFormatter={(v) => `${v.toFixed(1)}%`} tick={{ fontSize: 10, fill: '#9ca3af' }} />
              <Tooltip formatter={(v: unknown) => [`${Number(v).toFixed(2)}%`, 'EIR']} />
              <ReferenceLine y={baseIRR * 100} stroke="#9ca3af" strokeDasharray="4 2" />
              <Bar dataKey="irr" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
