import { useState } from 'react'

interface Props {
  missing: string[]
  foundColumns: string[]
  fileName: string
  onTryAgain: () => void
}

export function ValidationErrorModal({ missing, foundColumns, fileName, onTryAgain }: Props) {
  const [showDetected, setShowDetected] = useState(false)

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" style={{ background: 'rgba(5,13,26,0.65)', backdropFilter: 'blur(4px)' }}>
      <div className="relative w-full max-w-[520px] overflow-hidden rounded-[14px] border border-rose-200 bg-white shadow-2xl">

        {/* Red top accent */}
        <div className="h-[3px] w-full" style={{ background: 'linear-gradient(90deg, #b91c1c, #ef4444, #fca5a5)' }} />

        {/* Header */}
        <div className="flex items-start gap-3.5 px-6 pt-5 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[9px] border border-rose-200 bg-rose-50">
            <svg viewBox="0 0 20 20" className="h-5 w-5 fill-rose-600">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
            </svg>
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-semibold text-[#0d1117]">Invalid file structure detected</div>
            <div className="mt-0.5 text-[12px] text-[#4b5563]">
              Please upload the correct Excel, CSV, or JSON file.
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="rounded-[4px] border border-[#e2e6ed] bg-[#f7f8fa] px-2 py-0.5 font-mono text-[10px] text-[#4b5563]">
                {fileName}
              </span>
            </div>
          </div>
        </div>

        <div className="px-6 pb-5">
          {/* Missing columns */}
          <div className="mb-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="h-px flex-1 bg-rose-100" />
              <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-rose-500">
                Missing required columns ({missing.length})
              </span>
              <div className="h-px flex-1 bg-rose-100" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {missing.map((col) => (
                <span
                  key={col}
                  className="inline-flex items-center gap-1 rounded-[5px] border border-rose-200 bg-rose-50 px-2.5 py-1 font-mono text-[11px] font-medium text-rose-700"
                >
                  <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 shrink-0" fill="none">
                    <circle cx="6" cy="6" r="5.5" stroke="#ef4444"/>
                    <line x1="3.5" y1="3.5" x2="8.5" y2="8.5" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round"/>
                    <line x1="8.5" y1="3.5" x2="3.5" y2="8.5" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  {col}
                </span>
              ))}
            </div>
          </div>

          {/* Detected columns (collapsible) */}
          <div className="mb-4">
            <button
              type="button"
              onClick={() => setShowDetected((v) => !v)}
              className="flex w-full items-center gap-2 rounded-[7px] border border-[#e2e6ed] bg-[#f7f8fa] px-3 py-2 text-left transition-colors hover:bg-[#eef0f4]"
            >
              <svg
                viewBox="0 0 12 12"
                className={`h-2.5 w-2.5 shrink-0 fill-[#9ca3af] transition-transform ${showDetected ? 'rotate-90' : ''}`}
              >
                <path d="M4 2l4 4-4 4"/>
                <path d="M4 2l4 4-4 4" fill="none" stroke="#9ca3af" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="flex-1 font-mono text-[10.5px] text-[#4b5563]">
                Detected columns in your file ({foundColumns.length})
              </span>
            </button>
            {showDetected && (
              <div className="mt-1.5 flex flex-wrap gap-1 rounded-[7px] border border-[#e2e6ed] bg-[#f7f8fa] p-2.5">
                {foundColumns.length > 0 ? (
                  foundColumns.map((col) => (
                    <span
                      key={col}
                      className="rounded-[4px] border border-[#e2e6ed] bg-white px-2 py-0.5 font-mono text-[10px] text-[#4b5563]"
                    >
                      {col}
                    </span>
                  ))
                ) : (
                  <span className="font-mono text-[10.5px] text-[#9ca3af]">No columns detected</span>
                )}
              </div>
            )}
          </div>

          {/* Help text */}
          <div className="mb-4 rounded-[7px] border border-[#cddaf4] bg-[#eaf0fb] px-3.5 py-3 text-[11.5px] leading-relaxed text-[#2756a3]">
            <strong>Tip:</strong> Rename your column headers to match the required names exactly, or download the sample file below to use as a template.
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onTryAgain}
              className="flex flex-1 items-center justify-center gap-2 rounded-[8px] py-2.5 text-[13px] font-semibold text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #162d5e, #2756a3)', boxShadow: '0 3px 14px rgba(39,86,163,0.28)' }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 5px 18px rgba(39,86,163,0.4)' }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 3px 14px rgba(39,86,163,0.28)' }}
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M8 2v4l2.5-2.5"/>
                <path d="M3.5 9A5 5 0 1013 8"/>
              </svg>
              Try again
            </button>

            <a
              href="/sample-portfolio.xlsx"
              download="sample-portfolio.xlsx"
              className="flex items-center justify-center gap-1.5 rounded-[8px] border border-[#e2e6ed] bg-[#f7f8fa] px-4 py-2.5 text-[12.5px] font-medium text-[#4b5563] transition-colors hover:border-[#9bbae8] hover:bg-[#eaf0fb] hover:text-[#1e3f7a]"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M8 2v8m0 0l-3-3m3 3l3-3"/>
                <path d="M2 13h12"/>
              </svg>
              Download sample
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
