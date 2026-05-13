import type { Deal, IRRResult, VerifiedResult } from '../dealTypes'

/**
 * Build a single batch prompt that sends all browser-computed IRR values to Claude
 * and asks it to independently verify (or correct) each one.
 */
export function buildVerifyPrompt(
  deals: Deal[],
  browserIRRs: Record<string, IRRResult | null>,
): string {
  // Compact CSV format — drastically shorter prompt for faster LLM response
  const header = 'deal_id,rate,io,amort,tenure,orig_fee,eot_fee,pik_rate,browser_eir,browser_moic'
  const rows = deals.map((d) => {
    const b = browserIRRs[d.id]
    return [
      d.id,
      (d.rate * 100).toFixed(3),
      d.io,
      d.amort,
      d.tenure,
      (d.orig_fee * 100).toFixed(3),
      (d.eot_fee * 100).toFixed(3),
      ((d.pik_rate || 0) * 100).toFixed(3),
      b ? (b.annIRR * 100).toFixed(4) : '',
      b ? b.MOIC.toFixed(4) : '',
    ].join(',')
  })

  return `Verify private-credit IRR calcs. For each deal: EIR via Newton-Raphson (CF₀=−P×(1−orig_fee), monthly coupon+amort, CFₙ+=P×eot_fee), MOIC=(total_in/P), totalIncome=total interest+fees. Set corrected=true if your EIR differs >5bps. Reply ONLY with JSON array, zero prose.

Format: [{"deal_id":"X","annIRR":0.1234,"moic":1.23,"totalIncome":100000,"corrected":false}]

${header}
${rows.join('\n')}`
}

/**
 * Extract VerifiedResult[] from Claude's text response.
 * Returns empty array on any parse failure (caller falls back to browser values).
 */
export function parseVerifyResponse(answer: string): VerifiedResult[] {
  try {
    // Try to extract a JSON array from the response (handles cases where
    // Claude wraps it in text or adds minor commentary)
    const jsonMatch = answer.match(/\[\s*\{[\s\S]*?\}\s*\]/)
    if (!jsonMatch) return []

    const raw = JSON.parse(jsonMatch[0]) as unknown[]
    if (!Array.isArray(raw)) return []

    const results: VerifiedResult[] = []
    for (const item of raw) {
      if (
        typeof item === 'object' && item !== null &&
        'deal_id' in item && typeof (item as Record<string, unknown>).deal_id === 'string' &&
        'annIRR'  in item && typeof (item as Record<string, unknown>).annIRR  === 'number' &&
        'moic'    in item && typeof (item as Record<string, unknown>).moic    === 'number' &&
        'corrected' in item
      ) {
        const r = item as Record<string, unknown>
        results.push({
          deal_id:     r.deal_id as string,
          annIRR:      r.annIRR as number,
          moic:        r.moic as number,
          totalIncome: typeof r.totalIncome === 'number' ? r.totalIncome as number : 0,
          corrected:   Boolean(r.corrected),
        })
      }
    }
    return results
  } catch {
    return []
  }
}

/**
 * Resolve the best IRR to display for a deal.
 * Returns the verified value if available, otherwise the browser value.
 */
export function resolveIRR(
  dealId: string,
  browserIRR: IRRResult | null,
  verifiedResults: Record<string, VerifiedResult>,
): { annIRR: number; moic: number; totalIncome: number; source: 'ai-verified' | 'ai-corrected' | 'browser' } {
  const v = verifiedResults[dealId]
  if (!v) {
    return {
      annIRR:      browserIRR?.annIRR ?? 0,
      moic:        browserIRR?.MOIC ?? 0,
      totalIncome: browserIRR?.totalIncome ?? 0,
      source: 'browser',
    }
  }
  return {
    annIRR:      v.annIRR,
    moic:        v.moic,
    totalIncome: v.totalIncome,
    source: v.corrected ? 'ai-corrected' : 'ai-verified',
  }
}
