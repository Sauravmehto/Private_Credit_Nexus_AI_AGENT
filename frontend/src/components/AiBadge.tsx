import type { VerifyStatus } from '../dealTypes'

interface Props {
  status: VerifyStatus
  corrected?: boolean
  className?: string
}

/**
 * Small inline badge indicating the AI verification state of a computed value.
 * - verifying  → spinning loader
 * - done + not corrected → green "AI ✓"
 * - done + corrected      → amber "AI corrected"
 * - failed / idle         → nothing rendered
 */
export function AiBadge({ status, corrected = false, className = '' }: Props) {
  if (status === 'verifying') {
    return null
  }

  if (status === 'done' && !corrected) {
    return (
      <span
        className={`inline-flex items-center gap-0.5 rounded-[4px] border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-emerald-700 ${className}`}
      >
        AI ✓
      </span>
    )
  }

  if (status === 'done' && corrected) {
    return (
      <span
        className={`inline-flex items-center gap-0.5 rounded-[4px] border border-amber-200 bg-amber-50 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-amber-700 ${className}`}
      >
        AI corrected
      </span>
    )
  }

  return null
}
