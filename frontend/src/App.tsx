import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { fetchHealth, getPortfolioAISummary, getPortfolioSummary } from './api'
import type { AppView, Deal } from './dealTypes'
import type { PortfolioSummaryResponse, ToolCall } from './types'

import { AppShell, type AppShellCrumb } from '@/components/layouts/app-shell'
import { Skeleton } from '@/components/ui/skeleton'

import { ConnectScreen } from './components/ConnectScreen'
import { Sidebar } from './components/Sidebar'
import { ChatPanel } from './components/ChatPanel'
import { IrrModal } from './components/IrrModal'

const PortfolioView = lazy(() => import('./components/views/PortfolioView').then((m) => ({ default: m.PortfolioView })))
const ChartsView = lazy(() => import('./components/views/ChartsView').then((m) => ({ default: m.ChartsView })))
const ScenarioView = lazy(() => import('./components/views/ScenarioView').then((m) => ({ default: m.ScenarioView })))
const CovenantView = lazy(() => import('./components/views/CovenantView').then((m) => ({ default: m.CovenantView })))
const DealView = lazy(() => import('./components/views/DealView').then((m) => ({ default: m.DealView })))

function ViewFallback() {
  return (
    <div className="flex h-full flex-col gap-3 p-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
        <Skeleton className="h-24 rounded-lg" />
      </div>
      <Skeleton className="min-h-[200px] flex-1 rounded-lg" />
    </div>
  )
}

export default function App() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [sourceName, setSourceName] = useState<string | null>(null)

  const [backendSummary, setBackendSummary] = useState<PortfolioSummaryResponse | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)

  const [view, setView] = useState<AppView>('portfolio')
  const [currentDealId, setCurrentDealId] = useState<string | null>(null)
  const currentDeal = deals.find((d) => d.id === currentDealId) ?? null

  const [showConnect, setShowConnect] = useState(true)

  const [chatOpen, setChatOpen] = useState(false)
  const [chatTitle, setChatTitle] = useState('Analysis')
  const [chatPrompt, setChatPrompt] = useState<string | undefined>(undefined)
  const [chatAnswer, setChatAnswer] = useState<string | undefined>(undefined)
  const [chatToolCalls, setChatToolCalls] = useState<ToolCall[] | undefined>(undefined)

  const [irrTarget, setIrrTarget] = useState<Deal | null | 'portfolio'>('portfolio')
  const [irrOpen, setIrrOpen] = useState(false)

  const [health, setHealth] = useState<Record<string, string> | null>(null)

  const refreshHealth = useCallback(async () => {
    try {
      setHealth(await fetchHealth())
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    void refreshHealth()
    const t = window.setInterval(refreshHealth, 30_000)
    return () => window.clearInterval(t)
  }, [refreshHealth])

  async function loadBackendSummary(newDeals: Deal[]) {
    if (!newDeals.length) return
    setSummaryLoading(true)
    setBackendSummary(null)
    try {
      const summary = await getPortfolioSummary(newDeals)
      setBackendSummary(summary)
    } catch {
      toast.message('Portfolio summary unavailable', {
        description: 'Using browser-side calculations until the API responds.',
      })
    } finally {
      setSummaryLoading(false)
    }
  }

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
      toast.error('Portfolio AI summary failed', { description: msg })
      openChat('Portfolio AI summary', undefined, `Error: ${msg}`)
    }
  }

  function handleToolChat(toolLabel: string, prompt: string) {
    openChat(toolLabel, prompt)
  }

  function breadcrumb(): AppShellCrumb[] {
    if (view === 'deal' && currentDeal) {
      return [
        { label: 'Portfolio overview', onClick: () => handleViewChange('portfolio') },
        { label: currentDeal.name },
      ]
    }
    const labels: Record<AppView, string> = {
      portfolio: 'Portfolio overview',
      charts: 'Charts',
      scenario: 'Scenario comparison',
      covenant: 'Covenant tracker',
      deal: 'Deal',
    }
    return [{ label: labels[view] }]
  }
  const crumbs = breadcrumb()

  return (
    <>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground focus:shadow-md"
      >
        Skip to main content
      </a>
      {showConnect && (
        <ConnectScreen
          onDealsLoaded={handleDealsLoaded}
          health={health}
        />
      )}

      <AppShell
        sidebar={({ closeMobileNav }) => (
          <Sidebar
            deals={deals}
            view={view}
            currentDealId={currentDealId}
            sourceName={sourceName}
            health={health}
            onViewChange={handleViewChange}
            onDealSelect={handleDealSelect}
            onChangeSource={() => setShowConnect(true)}
            onMobileNavClose={closeMobileNav}
          />
        )}
        crumbs={crumbs}
        summaryLoading={summaryLoading}
        chatAside={
          <ChatPanel
            open={chatOpen}
            title={chatTitle}
            onClose={() => {
              setChatOpen(false)
              setChatPrompt(undefined)
              setChatAnswer(undefined)
              setChatToolCalls(undefined)
            }}
            initialPrompt={chatPrompt}
            initialAssistantMessage={chatAnswer}
            initialToolCalls={chatToolCalls}
          />
        }
      >
        <Suspense fallback={<ViewFallback />}>
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
            <ChartsView deals={deals} backendSummary={backendSummary} />
          )}
          {view === 'scenario' && (
            <ScenarioView deals={deals} onAIAnalysis={(p) => openChat('Scenario analysis', p)} />
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
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Select a deal from the sidebar.
            </div>
          )}
        </Suspense>
      </AppShell>

      {irrOpen && (
        <IrrModal
          deal={irrTarget === 'portfolio' ? null : (irrTarget as Deal | null)}
          allDeals={deals}
          backendSummary={backendSummary}
          onClose={() => setIrrOpen(false)}
        />
      )}
    </>
  )
}
