import type { ScenarioDraft } from './scenarioValidation'
import type { AmortRowResponse, DealMetricsResponse } from '../types'

export interface SavedScenario {
  id: string
  draft: ScenarioDraft
  metrics: DealMetricsResponse | null
  amortRows: AmortRowResponse[]
  label: string
  savedAt: number
}

export const MAX_SAVED_SCENARIOS = 5

export function scenarioTabLabel(draft: ScenarioDraft): string {
  const rate = parseFloat(draft.ratePct)
  const rateStr = Number.isNaN(rate) ? draft.ratePct : `${rate.toFixed(2)}%`
  return `${rateStr} · IO ${draft.io} · ${draft.tenure}mo`
}

export function pushSavedScenario(list: SavedScenario[], next: SavedScenario): SavedScenario[] {
  const nextList = [...list, next]
  if (nextList.length <= MAX_SAVED_SCENARIOS) return nextList
  return nextList.slice(nextList.length - MAX_SAVED_SCENARIOS)
}

export function createSavedScenario(
  draft: ScenarioDraft,
  metrics: DealMetricsResponse | null,
  amortRows: AmortRowResponse[],
): SavedScenario {
  return {
    id: crypto.randomUUID(),
    draft: { ...draft },
    metrics,
    amortRows,
    label: scenarioTabLabel(draft),
    savedAt: Date.now(),
  }
}
