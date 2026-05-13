import { useCallback, useEffect, useState } from 'react'
import { fetchHealth, getPortfolioAISummary, getPortfolioSummary } from './api'
import type { AppView, Deal } from './dealTypes'
import type { PortfolioSummaryResponse, ToolCall } from './types'

import { ConnectScreen } from './components/ConnectScreen'
import { Sidebar } from './components/Sidebar'
import { ChatPanel } from './components/ChatPanel'
import { IrrModal } from './components/IrrModal'
import { PortfolioView } from './components/views/PortfolioView'
import { ChartsView } from './components/views/ChartsView'
import { ScenarioView } from './components/views/ScenarioView'
import { CovenantView } from './components/views/CovenantView'
import { DealView } from './components/views/DealView'

export default function App() {
  // ── DATA ──────────────────────────────────────────────────────────
  const [deals, setDeals] = useState<Deal[]>([])
  const [sourceName, setSourceName] = useState<string | null>(null)

  // ── BACKEND SUMMARY ───────────────────────────────────────────────
  const [backendSummary, setBackendSummary] = useState<PortfolioSummaryResponse | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  // ── NAVIGATION ────────────────────────────────────────────────────
  const [view, setView] = useState<AppView>('portfolio')
  const [currentDealId, setCurrentDealId] = useState<string | null>(null)
  const currentDeal = deals.find((d) => d.id === currentDealId) ?? null

  // ── CONNECT SCREEN ────────────────────────────────────────────────
  const [showConnect, setShowConnect] = useState(true)

  // ── CHAT ──────────────────────────────────────────────────────────
  const [chatOpen, setChatOpen] = useState(false)
  const [chatTitle, setChatTitle] = useState('Analysis')
  const [chatPrompt, setChatPrompt] = useState<string | undefined>(undefined)
  const [chatAnswer, setChatAnswer] = useState<string | undefined>(undefined)
  const [chatToolCalls, setChatToolCalls] = useState<ToolCall[] | undefined>(undefined)

  // ── IRR MODAL ─────────────────────────────────────────────────────
  const [irrTarget, setIrrTarget] = useState<Deal | null | 'portfolio'>('portfolio')
  const [irrOpen, setIrrOpen] = useState(false)

  // ── HEALTH ────────────────────────────────────────────────────────
  const [health, setHealth] = useState<Record<string, string> | null>(null)

  const refreshHealth = useCallback(async () => {
    try { setHealth(await fetchHealth()) } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    void refreshHealth()
    const t = window.setInterval(refreshHealth, 30_000)
    return () => window.clearInterval(t)
  }, [refreshHealth])

  // ── BACKEND SUMMARY ───────────────────────────────────────────────
  async function loadBackendSummary(newDeals: Deal[]) {
    if (!newDeals.length) return
    setSummaryLoading(true)
    setBackendSummary(null)
    try {
      const summary = await getPortfolioSummary(newDeals)
      setBackendSummary(summary)
    } catch {
      // silently fall back to browser calculations
    } finally {
      setSummaryLoading(false)
    }
  }

  // ── HANDLERS ──────────────────────────────────────────────────────
  function handleDealsLoaded(newDeals: Deal[], name: string) {
    setDeals(newDeals)
    setSourceName(name)
    setShowConnect(false)
    setView('portfolio')
    setCurrentDealId(null)
    setBackendSummary(null)
    void loadBackendSummary(newDeals)
  }

  function handleDealSelect(id: string) {
    setCurrentDealId(id)
    setView('deal')
  }

  function handleViewChange(v: AppView) {
    setView(v)
    if (v !== 'deal') setCurrentDealId(null)
  }

  function openIrr(deal: Deal | null) {
    setIrrTarget(deal)
    setIrrOpen(true)
  }

  function openChat(title: string, prompt?: string, answer?: string, toolCalls?: ToolCall[]) {
    setChatTitle(title)
    setChatPrompt(prompt)
    setChatAnswer(answer)
    setChatToolCalls(toolCalls)
    setChatOpen(true)
  }

  async function handlePortfolioAISummary() {
    openChat('Portfolio AI summary', undefined, 'Generating Anthropic portfolio summary…')
    try {
      const result = await getPortfolioAISummary(deals)
      openChat('Portfolio AI summary', undefined, result.summary, result.tool_calls)
      setBackendSummary(result.metrics)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to generate portfolio AI summary.'
      openChat('Portfolio AI summary', undefined, `Error: ${msg}`)
    }
  }

  function handleToolChat(toolLabel: string, prompt: string) {
    openChat(toolLabel, prompt)
  }

  // ── BREADCRUMB ────────────────────────────────────────────────────
  function breadcrumb(): { label: string; onClick?: () => void }[] {
    if (view === 'deal' && currentDeal) {
      return [
        { label: 'Portfolio overview', onClick: () => handleViewChange('portfolio') },
        { label: currentDeal.name },
      ]
    }
    const labels: Record<AppView, string> = {
      portfolio: 'Portfolio overview',
      charts:    'Charts',
      scenario:  'Scenario comparison',
      covenant:  'Covenant tracker',
      deal:      'Deal',
    }
    return [{ label: labels[view] }]
  }
  const crumbs = breadcrumb()

  return (
    <div id="app" className="flex h-screen overflow-hidden" style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 14, color: '#0d1117' }}>

      {/* Connect screen (fullscreen onboarding) */}
      {showConnect && (
        <ConnectScreen
          onDealsLoaded={handleDealsLoaded}
          health={health}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        deals={deals}
        view={view}
        currentDealId={currentDealId}
        sourceName={sourceName}
        health={health}
        onViewChange={handleViewChange}
        onDealSelect={handleDealSelect}
        onChangeSource={() => setShowConnect(true)}
      />

      {/* Main area */}
      <div id="main" className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <div
          className="flex h-12 shrink-0 items-center gap-2.5 border-b bg-white px-5"
          style={{ borderColor: '#e2e6ed' }}
        >
          <div className="flex flex-1 items-center gap-1.5 text-[13px] text-[#4b5563]">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span style={{ color: '#d0d5df' }}>/</span>}
                {c.onClick ? (
                  <button type="button" onClick={c.onClick}
                    className="font-medium text-[#2756a3] hover:text-[#162d5e]">
                    {c.label}
                  </button>
                ) : (
                  <span className="font-medium text-[#0d1117]">{c.label}</span>
                )}
              </span>
            ))}
          </div>

        </div>

        {/* Content + chat row */}
        <div className="flex min-w-0 flex-1 overflow-hidden">
          {/* Content */}
          <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden" style={{ background: '#f7f8fa' }}>
            {/* Subtle loading indicator while backend computes portfolio summary */}
            {summaryLoading && (
              <div className="absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden" style={{ background: '#e2e6ed' }}>
                <div className="h-full animate-pulse" style={{ background: 'linear-gradient(90deg, transparent, #4f9cf9, transparent)', width: '60%', animation: 'slide 1.5s ease-in-out infinite' }} />
              </div>
            )}
            <div id="content" className="flex-1 overflow-hidden">
              {view === 'portfolio' && (
                <PortfolioView
                  deals={deals}
                  backendSummary={backendSummary}
                  summaryLoading={summaryLoading}
                  onDealSelect={handleDealSelect}
                  onIrrClick={openIrr}
                  onAIAnalysis={() => void handlePortfolioAISummary()}
                />
              )}
              {view === 'charts' && (
                <ChartsView
                  deals={deals}
                  backendSummary={backendSummary}
                />
              )}
              {view === 'scenario' && (
                <ScenarioView
                  deals={deals}
                  onAIAnalysis={(p) => openChat('Scenario analysis', p)}
                />
              )}
              {view === 'covenant' && (
                <CovenantView deals={deals} onAIAnalysis={(p) => openChat('Covenant review', p)} />
              )}
              {view === 'deal' && currentDeal && (
                <DealView
                  deal={currentDeal}
                  backendSummary={backendSummary}
                  onIrrClick={openIrr}
                  onTool={(label, prompt) => handleToolChat(label, prompt)}
                />
              )}
              {view === 'deal' && !currentDeal && deals.length === 0 && (
                <div className="flex h-full items-center justify-center text-[13px] text-[#9ca3af]">
                  Select a deal from the sidebar.
                </div>
              )}
            </div>
          </div>

          {/* Chat panel */}
          <ChatPanel
            open={chatOpen}
            title={chatTitle}
            onClose={() => { setChatOpen(false); setChatPrompt(undefined); setChatAnswer(undefined); setChatToolCalls(undefined) }}
            initialPrompt={chatPrompt}
            initialAssistantMessage={chatAnswer}
            initialToolCalls={chatToolCalls}
          />
        </div>
      </div>

      {/* IRR modal */}
      {irrOpen && (
        <IrrModal
          deal={irrTarget === 'portfolio' ? null : (irrTarget as Deal | null)}
          allDeals={deals}
          backendSummary={backendSummary}
          onClose={() => setIrrOpen(false)}
        />
      )}
    </div>
  )
}
