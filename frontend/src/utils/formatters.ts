/** Format number as full dollar amount: $600,000 / $1,950,000 */
export function fD(v: number): string {
  const n = v || 0
  return `$${Math.round(n).toLocaleString()}`
}

/** Format fraction as percent with 2 decimals: 0.125 → "12.50%" */
export function fP(v: number): string {
  return `${((v || 0) * 100).toFixed(2)}%`
}

/** Format fraction as percent with 1 decimal: 0.125 → "12.5%" */
export function fPct1(v: number): string {
  return `${((v || 0) * 100).toFixed(1)}%`
}

/** Format a Date as "Jan 15, 2026" */
export function fDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
