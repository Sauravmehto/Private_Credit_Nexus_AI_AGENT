import type { Deal, AppView, DealStatus } from '../dealTypes'
import { getInstrumentConfig } from '../dealTypes'

interface Props {
  deals: Deal[]
  view: AppView
  currentDealId: string | null
  sourceName: string | null
  health: Record<string, string> | null
  onViewChange: (v: AppView) => void
  onDealSelect: (id: string) => void
  onChangeSource: () => void
}

const NAV_ITEMS: { id: AppView; label: string; icon: React.ReactNode }[] = [
  {
    id: 'portfolio',
    label: 'Portfolio',
    icon: (
      <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    id: 'charts',
    label: 'Charts',
    icon: (
      <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
        <line x1="16" y1="7" x2="22" y2="7"/>
        <line x1="22" y1="7" x2="22" y2="13"/>
      </svg>
    ),
  },
  {
    id: 'scenario',
    label: 'Scenario comparison',
    icon: (
      <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
  {
    id: 'covenant',
    label: 'Covenant tracker',
    icon: (
      <svg viewBox="0 0 24 24" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622C17.176 19.29 21 14.591 21 9c0-1.042-.133-2.052-.382-3.016z"/>
      </svg>
    ),
  },
]

function dotColor(s: DealStatus): string {
  if (s === 'compliant')     return '#10b981'
  if (s === 'monitoring')    return '#f59e0b'
  return '#ef4444'
}

export function Sidebar({ deals, view, currentDealId, health, onViewChange, onDealSelect }: Props) {
  const isLive = deals.length > 0

  return (
    <div
      className="flex w-[220px] shrink-0 flex-col overflow-hidden border-r"
      style={{
        background: 'linear-gradient(175deg, #0a1628 0%, #050d1a 100%)',
        borderColor: 'rgba(255,255,255,0.06)',
      }}
    >
      {/* Brand */}
      <div className="border-b px-3 pb-3 pt-4" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="mb-0.5 flex items-center gap-2">
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
               style={{ background: 'linear-gradient(135deg, #4f9cf9, #3d72c8)' }}>
            <svg viewBox="0 0 24 24" className="h-3 w-3 fill-white">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span className="text-[12.5px] font-semibold text-white">
            PrivateCreditNexus<span style={{ color: '#4f9cf9' }}>AI</span>
          </span>
        </div>
        <p className="pl-8 text-[9px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
          by <span style={{ color: '#6696db', fontWeight: 500 }}>DataAlpha.ai</span>
        </p>
      </div>

      {/* Navigation */}
      <div className="px-1.5 pt-2.5">
        <p className="mb-1.5 px-2 text-[9px] font-semibold uppercase tracking-[0.12em]"
           style={{ color: 'rgba(255,255,255,0.28)' }}>Views</p>
        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = view === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onViewChange(item.id)}
                className={`relative flex w-full items-center gap-1.5 rounded-[5px] border px-2 py-1.5 text-left text-[12px] transition-all duration-150 ${
                  active
                    ? 'border-[rgba(79,156,249,0.22)] bg-[rgba(79,156,249,0.14)] text-white si-active'
                    : 'border-transparent text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.06)] hover:text-white'
                }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Deal list */}
      {isLive && (
        <div className="mt-2 px-1.5">
          <p className="mb-1.5 px-2 text-[9px] font-semibold uppercase tracking-[0.12em]"
             style={{ color: 'rgba(255,255,255,0.28)' }}>Deals</p>
          <div className="space-y-0.5 overflow-y-auto" style={{ maxHeight: 220 }}>
            {deals.map((d) => {
              const cfg = getInstrumentConfig(d)
              const active = currentDealId === d.id
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onDealSelect(d.id)}
                  className={`relative flex w-full items-center gap-1.5 rounded-[5px] border px-2 py-1.5 text-left text-[12px] transition-all duration-150 ${
                    active
                      ? 'border-[rgba(79,156,249,0.22)] bg-[rgba(79,156,249,0.14)] text-white'
                      : 'border-transparent text-[rgba(255,255,255,0.45)] hover:bg-[rgba(255,255,255,0.06)] hover:text-white'
                  }`}
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dotColor(d.status) }} />
                  <span className="flex-1 truncate">{d.name}</span>
                  <span className="shrink-0 font-mono text-[9px]" style={{ color: 'rgba(255,255,255,0.2)' }}>{cfg.l}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-auto border-t px-3 py-3" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        {/* Top accent line */}
        <div
          className="mb-3 h-[1px] w-full rounded-full"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(79,156,249,0.35), transparent)' }}
        />

        {/* Brand */}
        <div className="mb-2 flex items-center gap-2">
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px]"
            style={{ background: 'linear-gradient(135deg, #4f9cf9, #3d72c8)' }}
          >
            <svg viewBox="0 0 24 24" className="h-3 w-3 fill-white">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-white">
              PrivateCreditNexus<span style={{ color: '#4f9cf9' }}>AI</span>
            </div>
            <div className="font-mono text-[8.5px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
              by <span style={{ color: '#6696db' }}>DataAlpha.ai</span>
            </div>
          </div>
        </div>

        {/* Status row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="ai-dot" />
            <span className="font-mono text-[9.5px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Claude AI</span>
          </div>
          {health?.mongodb === 'ok' && (
            <div className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="font-mono text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>MongoDB</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
