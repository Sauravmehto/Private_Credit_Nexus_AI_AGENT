import { useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { DotLottieReact } from '@lottiefiles/dotlottie-react'
import type { Deal } from '../dealTypes'
import { uploadPortfolio } from '../api'
import { SAMPLE_PORTFOLIOS } from '../config/samplePortfolios'
import { ValidationErrorModal } from './ValidationErrorModal'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

interface Props {
  onDealsLoaded: (deals: Deal[], sourceName: string) => void
  health: Record<string, string> | null
}

type Source = 'file' | 'path' | 'server' | null

const pathFormSchema = z.object({
  url: z
    .string()
    .min(1, 'Enter a URL')
    .refine(
      (s) => {
        try {
          const u = new URL(s.trim())
          return u.protocol === 'http:' || u.protocol === 'https:'
        } catch {
          return false
        }
      },
      { message: 'Enter a valid http(s) URL' },
    ),
})

const STATS = [
  { value: '21+',    label: 'AI analysis tools' },
  { value: '$2B+',   label: 'Deals analysed' },
  { value: '0.01s',  label: 'IRR calculation' },
  { value: '100%',   label: 'Private & secure' },
]

const CAPABILITIES = [
  { icon: '📈', title: 'IRR decomposition',     desc: 'Coupon · origination · EOT · PIK in bps' },
  { icon: '📋', title: 'Amortization schedule', desc: 'Full month-by-month cash flow table' },
  { icon: '🔄', title: 'Restructure scenarios', desc: '8 preset + custom scenario builder' },
  { icon: '🛡', title: 'Covenant tracking',     desc: 'Threshold alerts & breach remediation' },
  { icon: '📊', title: 'Portfolio analytics',   desc: 'Charts, allocation & performance' },
  { icon: '🤖', title: 'Claude AI analysis',    desc: 'Natural language deep dives' },
]

export function ConnectScreen({ onDealsLoaded }: Props) {
  const [source, setSource] = useState<Source>('file')
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const pathForm = useForm<z.infer<typeof pathFormSchema>>({
    resolver: zodResolver(pathFormSchema),
    defaultValues: { url: '' },
  })

  // Validation state
  const [validationErrors, setValidationErrors] = useState<{ missing: string[]; foundColumns: string[]; fileName: string } | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<{ dealCount: number; fileName: string } | null>(null)

  async function loadSamplePortfolio(sample: (typeof SAMPLE_PORTFOLIOS)[number]) {
    setSource('file')
    setValidationErrors(null)
    setUploadSuccess(null)
    setError(null)
    setLoading(true)
    try {
      const resp = await fetch(sample.file)
      if (!resp.ok) throw new Error(`Could not load sample (${resp.status})`)
      const blob = await resp.blob()
      const file = new File([blob], sample.filename, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
      const { deals, filename } = await uploadPortfolio(file)
      setUploadSuccess({ dealCount: deals.length, fileName: filename })
      setTimeout(() => onDealsLoaded(deals, filename), 900)
    } catch (e) {
      const err = e as Error & { missingColumns?: string[] }
      if (err.missingColumns && err.missingColumns.length > 0) {
        setValidationErrors({ missing: err.missingColumns, foundColumns: [], fileName: sample.filename })
      } else {
        const msg = err.message || 'Could not load sample portfolio'
        setError(msg)
        toast.error('Sample load failed', { description: msg })
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleFile(file: File) {
    setValidationErrors(null)
    setUploadSuccess(null)
    setError(null)
    setLoading(true)
    try {
      const { deals, filename } = await uploadPortfolio(file)
      setUploadSuccess({ dealCount: deals.length, fileName: filename })
      setTimeout(() => onDealsLoaded(deals, filename), 900)
    } catch (e) {
      const err = e as Error & { missingColumns?: string[] }
      if (err.missingColumns && err.missingColumns.length > 0) {
        setValidationErrors({ missing: err.missingColumns, foundColumns: [], fileName: file.name })
      } else {
        const msg = err.message || 'Upload error'
        setError(msg)
        toast.error('Upload failed', { description: msg })
      }
    } finally {
      setLoading(false)
    }
  }

  function handleTryAgain() {
    setValidationErrors(null)
    setUploadSuccess(null)
    setError(null)
    // Re-open the file picker
    setTimeout(() => fileInputRef.current?.click(), 100)
  }

  async function handlePathSubmit(values: z.infer<typeof pathFormSchema>) {
    const url = values.url.trim()
    if (!url) return
    setValidationErrors(null)
    setUploadSuccess(null)
    setError(null)
    setLoading(true)
    try {
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const blob = await resp.blob()
      const ext = url.split('.').pop()?.toLowerCase() || 'xlsx'
      const file = new File([blob], `portfolio.${ext}`)
      const { deals, filename } = await uploadPortfolio(file)
      setUploadSuccess({ dealCount: deals.length, fileName: filename })
      setTimeout(() => onDealsLoaded(deals, filename), 900)
    } catch (e) {
      const err = e as Error & { missingColumns?: string[] }
      if (err.missingColumns && err.missingColumns.length > 0) {
        setValidationErrors({ missing: err.missingColumns, foundColumns: [], fileName: url })
      } else {
        const msg = err.message || 'Connection error'
        setError(msg)
        toast.error('Could not load portfolio', { description: msg })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden"
      style={{ background: '#f7f8fa' }}
    >
      {/* Validation error modal */}
      {validationErrors && (
        <ValidationErrorModal
          missing={validationErrors.missing}
          foundColumns={validationErrors.foundColumns}
          fileName={validationErrors.fileName}
          onTryAgain={handleTryAgain}
        />
      )}
      {/* Full-height two-column grid */}
      <div className="grid h-full" style={{ gridTemplateColumns: '42% 58%' }}>

        {/* ── LEFT PANEL: brand + animation + stats ─────────────────── */}
        <div
          className="relative flex flex-col overflow-hidden"
          style={{ background: 'linear-gradient(165deg, #0a1628 0%, #050d1a 60%, #0f2044 100%)' }}
        >
          {/* Subtle grid overlay */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: 'linear-gradient(rgba(79,156,249,1) 1px, transparent 1px), linear-gradient(90deg, rgba(79,156,249,1) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />

          {/* Top accent line */}
          <div
            className="absolute inset-x-0 top-0 h-[2px]"
            style={{ background: 'linear-gradient(90deg, transparent, #4f9cf9, #3d72c8, transparent)' }}
          />

          <div className="relative flex flex-1 flex-col px-10 py-8">
            {/* Logo */}
            <div className="mb-8 flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-[10px]"
                style={{ background: 'linear-gradient(135deg, #4f9cf9, #3d72c8)', boxShadow: '0 0 20px rgba(79,156,249,0.35)' }}
              >
                <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-white" style={{ width: 18, height: 18 }}>
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div>
                <div className="text-[15px] font-semibold text-white">
                  PrivateCreditNexus<span style={{ color: '#4f9cf9' }}>AI</span>
                </div>
                <div className="font-mono text-[9.5px]" style={{ color: 'rgba(255,255,255,0.3)' }}>by DataAlpha.ai</div>
              </div>
            </div>

            {/* Headline */}
            <div className="mb-2 text-[28px] font-semibold leading-tight text-white">
              Private credit<br />
              <span style={{ color: '#4f9cf9' }}>intelligence</span> platform
            </div>
            <p className="mb-6 text-[13.5px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
              IRR decomposition · scenario analysis · covenant tracking · AI-powered deal intelligence
            </p>

            {/* Lottie animation */}
            <div className="mb-6 flex items-center justify-center" style={{ height: 220 }}>
              <DotLottieReact
                src="/animation.lottie"
                loop
                autoplay
                style={{ width: 280, height: 220 }}
              />
            </div>

            {/* Stats row */}
            <div className="mb-8 grid grid-cols-4 gap-2">
              {STATS.map(({ value, label }) => (
                <div
                  key={label}
                  className="rounded-[7px] border px-3 py-2.5 text-center"
                  style={{ background: 'rgba(79,156,249,0.08)', borderColor: 'rgba(79,156,249,0.18)' }}
                >
                  <div className="mb-0.5 font-mono text-[15px] font-bold" style={{ color: '#4f9cf9' }}>{value}</div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.08em]" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Capabilities */}
            <div className="grid grid-cols-2 gap-1.5">
              {CAPABILITIES.map(({ icon, title, desc }) => (
                <div
                  key={title}
                  className="flex items-start gap-2 rounded-[7px] border px-3 py-2"
                  style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}
                >
                  <span className="mt-0.5 text-[14px]">{icon}</span>
                  <div>
                    <div className="text-[11.5px] font-medium text-white">{title}</div>
                    <div className="text-[10px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* AI status footer */}
          </div>
        </div>

        {/* ── RIGHT PANEL: connect form ──────────────────────────────── */}
        <div className="flex flex-col items-center justify-center overflow-y-auto bg-white px-12 py-10">
          <Card className="w-full max-w-[440px] border-border shadow-md">
            <CardHeader className="space-y-1 pb-2">
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Get started
              </div>
              <CardTitle className="text-[22px] font-semibold leading-tight">Connect your portfolio</CardTitle>
              <CardDescription className="text-[13px] leading-relaxed">
                Load your deal data to unlock IRR analysis, covenant monitoring, restructure scenarios and AI-powered insights.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
            {/* Source cards */}
            <div className="mb-5 grid grid-cols-3 gap-2.5">
              {([
                {
                  id: 'file',
                  label: 'Upload file',
                  sub: 'Excel, CSV or JSON',
                  icon: (
                    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 18, height: 18 }}>
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="12" y1="11" x2="12" y2="17"/>
                      <line x1="9" y1="14" x2="15" y2="14"/>
                    </svg>
                  ),
                },
                {
                  id: 'path',
                  label: 'URL / path',
                  sub: 'Shared drive or URL',
                  icon: (
                    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 18, height: 18 }}>
                      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                    </svg>
                  ),
                },
                {
                  id: 'server',
                  label: 'API / server',
                  sub: "Firm's data endpoint",
                  icon: (
                    <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 18, height: 18 }}>
                      <rect x="2" y="2" width="20" height="8" rx="2"/>
                      <rect x="2" y="14" width="20" height="8" rx="2"/>
                      <line x1="6" y1="6" x2="6.01" y2="6"/>
                      <line x1="6" y1="18" x2="6.01" y2="18"/>
                    </svg>
                  ),
                },
              ] as const).map((card) => (
                <Button
                  key={card.id}
                  type="button"
                  variant="outline"
                  onClick={() => setSource(card.id as Source)}
                  className={`group flex h-auto flex-col items-center gap-2.5 rounded-[10px] border p-4 text-center font-normal transition-all duration-200 ${
                    source === card.id
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50 hover:shadow-sm'
                  }`}
                >
                  <div className={`flex h-9 w-9 items-center justify-center rounded-[8px] border transition-colors ${
                    source === card.id ? 'border-[#9bbae8] bg-[#cddaf4] text-[#1e3f7a]' : 'border-[#cddaf4] bg-[#eaf0fb] text-[#1e3f7a]'
                  }`}>
                    {card.icon}
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold text-[#0d1117]">{card.label}</div>
                    <div className="mt-0.5 text-[10.5px] leading-relaxed text-[#9ca3af]">{card.sub}</div>
                  </div>
                </Button>
              ))}
            </div>

            {/* File upload area */}
            {source === 'file' && (
              <div className="mb-4">
                {/* Drop zone */}
                {uploadSuccess ? (
                  /* Success state */
                  <div className="rounded-[10px] border-2 border-emerald-400 bg-emerald-50 px-6 py-7 text-center">
                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-[9px] border border-emerald-300 bg-emerald-100">
                      <svg viewBox="0 0 20 20" className="h-5 w-5 fill-emerald-600">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                      </svg>
                    </div>
                    <p className="mb-0.5 text-[13px] font-semibold text-emerald-700">Valid portfolio file</p>
                    <p className="text-[11.5px] text-emerald-600">
                      {uploadSuccess.dealCount} deals found in <span className="font-mono">{uploadSuccess.fileName}</span>
                    </p>
                    <div className="mt-2 flex items-center justify-center gap-1.5">
                      <div className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-500" />
                      <span className="font-mono text-[10px] text-emerald-600">Loading portfolio…</span>
                    </div>
                  </div>
                ) : (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault(); setDragging(false)
                      const f = e.dataTransfer.files[0]; if (f) void handleFile(f)
                    }}
                    onClick={() => !loading && fileInputRef.current?.click()}
                    className={`cursor-pointer rounded-[10px] border-2 border-dashed px-6 py-7 text-center transition-all ${
                      validationErrors
                        ? 'border-rose-400 bg-rose-50'
                        : dragging
                          ? 'border-[#3d72c8] bg-[#eaf0fb]'
                          : 'border-[#d0d5df] bg-[#f7f8fa] hover:border-[#3d72c8] hover:bg-[#eaf0fb]'
                    }`}
                  >
                    <div className={`mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-[9px] border ${
                      validationErrors ? 'border-rose-200 bg-rose-100' : 'border-[#cddaf4] bg-[#eaf0fb]'
                    }`}>
                      {loading ? (
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#4f9cf9] border-t-transparent" />
                      ) : validationErrors ? (
                        <svg viewBox="0 0 20 20" className="h-5 w-5 fill-rose-500">
                          <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#1e3f7a" strokeWidth="1.5">
                          <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                        </svg>
                      )}
                    </div>
                    {loading ? (
                      <>
                        <p className="mb-0.5 text-[13px] font-medium text-[#0d1117]">Validating file…</p>
                        <p className="text-[11.5px] text-[#9ca3af]">Checking schema and parsing deals</p>
                      </>
                    ) : validationErrors ? (
                      <>
                        <p className="mb-0.5 text-[13px] font-medium text-rose-700">Invalid file structure</p>
                        <p className="text-[11.5px] text-rose-500">{validationErrors.missing.length} required column{validationErrors.missing.length !== 1 ? 's' : ''} missing · click to retry</p>
                      </>
                    ) : (
                      <>
                        <p className="mb-0.5 text-[13px] font-medium text-[#0d1117]">Drop your file here</p>
                        <p className="text-[11.5px] text-[#9ca3af]">or click to browse &nbsp;·&nbsp; .xlsx &nbsp;·&nbsp; .csv &nbsp;·&nbsp; .json</p>
                      </>
                    )}
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.json"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = '' }}
                />

                {/* Required columns note */}
                <div className="mt-2.5 flex items-start gap-1.5 rounded-[7px] border border-[#cddaf4] bg-[#eaf0fb] px-3 py-2">
                  <svg viewBox="0 0 16 16" className="mt-0.5 h-3 w-3 shrink-0 fill-[#2756a3]">
                    <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm1 12H7V7h2v5zm0-6H7V4h2v2z"/>
                  </svg>
                  <p className="flex-1 text-[10.5px] leading-relaxed text-[#2756a3]">
                    <strong>Required columns:</strong> Borrower · Instrument Type · Principal · Interest Rate · Tenure · Orig. Fee · EOT Fee · Covenant Status
                  </p>
                </div>

                {/* One-click sample portfolios */}
                <div className="mt-3">
                  <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-[#9ca3af]">
                    Try a sample portfolio
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SAMPLE_PORTFOLIOS.map((sample) => (
                      <div key={sample.id} className="flex items-stretch overflow-hidden rounded-[7px] border border-[#cddaf4] bg-white">
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => void loadSamplePortfolio(sample)}
                          className="px-2.5 py-1.5 text-left transition-colors hover:bg-[#eaf0fb] disabled:opacity-50"
                          title={`Load ${sample.label}`}
                        >
                          <span className="block text-[11px] font-semibold text-[#2756a3]">{sample.shortLabel}</span>
                          <span className="block text-[9.5px] text-[#9ca3af]">Load</span>
                        </button>
                        <a
                          href={sample.file}
                          download={sample.filename}
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center border-l border-[#cddaf4] px-2 text-[#2756a3] transition-colors hover:bg-[#eaf0fb]"
                          title={`Download ${sample.filename}`}
                          aria-label={`Download ${sample.label}`}
                        >
                          <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                            <path d="M7 1v8m0 0L4.5 6.5M7 9l2.5-2.5"/><path d="M1.5 11.5h11"/>
                          </svg>
                        </a>
                      </div>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[10px] text-[#9ca3af]">Click a sample to load it instantly · ↓ to download only</p>
                </div>

                {/* Show "view errors" link when validation failed */}
                {validationErrors && (
                  <button
                    type="button"
                    onClick={() => setValidationErrors(validationErrors)}
                    className="mt-2 w-full rounded-[7px] border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] text-rose-700 transition-colors hover:bg-rose-100"
                  >
                    ⚠ {validationErrors.missing.length} missing column{validationErrors.missing.length !== 1 ? 's' : ''}: {validationErrors.missing.join(', ')} · <span className="underline">View details</span>
                  </button>
                )}
              </div>
            )}

            {/* URL / API form */}
            {(source === 'path' || source === 'server') && (
              <Form {...pathForm}>
                <form
                  className="mb-4 space-y-2"
                  onSubmit={pathForm.handleSubmit((v) => void handlePathSubmit(v))}
                >
                  <FormField
                    control={pathForm.control}
                    name="url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-mono text-[10.5px] uppercase tracking-[0.05em] text-muted-foreground">
                          {source === 'path' ? 'File URL or shared path' : 'API endpoint URL'}
                        </FormLabel>
                        <div className="flex gap-2">
                          <FormControl>
                            <Input
                              className="flex-1 rounded-md font-mono text-[12.5px]"
                              placeholder={source === 'path' ? 'https://…/portfolio.xlsx' : 'https://api.firm.com/portfolio'}
                              autoComplete="off"
                              {...field}
                            />
                          </FormControl>
                          <Button type="submit" disabled={loading} className="shrink-0 rounded-md px-4">
                            Connect
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            )}

            {/* No source selected placeholder */}
            {!source && (
              <div className="mb-4 rounded-[10px] border border-dashed border-[#e2e6ed] bg-[#f7f8fa] px-6 py-5 text-center">
                <p className="text-[12.5px] text-[#9ca3af]">Select a data source above to begin</p>
              </div>
            )}

            {/* Loading / error */}
            {loading && (
              <div className="mb-3 flex items-center gap-2.5 rounded-[7px] border border-[#cddaf4] bg-[#eaf0fb] px-4 py-2.5">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#4f9cf9] border-t-transparent" />
                <span className="font-mono text-[11.5px] text-[#2756a3]">Parsing file and building Deal[] dataset…</span>
              </div>
            )}
            {error && (
              <div className="mb-3 rounded-[7px] border border-rose-200 bg-rose-50 px-4 py-2.5 text-[11.5px] text-rose-700">
                <strong>Error:</strong> {error}
              </div>
            )}

            {/* CTA button */}
            {source === 'file' && !loading && (
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mb-4 flex w-full items-center justify-center gap-2 rounded-[9px] py-3 text-[13.5px] font-semibold text-primary-foreground shadow-md"
                style={{ background: 'linear-gradient(135deg, #162d5e, #2756a3)', boxShadow: '0 4px 20px rgba(39,86,163,0.3)' }}
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/>
                </svg>
                Choose portfolio file
              </Button>
            )}

            {/* Divider */}
            <div className="mb-4 flex items-center gap-3">
              <div className="flex-1 border-t" style={{ borderColor: '#e2e6ed' }} />
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#9ca3af]">Supported formats</span>
              <div className="flex-1 border-t" style={{ borderColor: '#e2e6ed' }} />
            </div>

            {/* Format pills + sample download */}
            <div className="mb-5 flex flex-wrap items-center gap-2">
              {[
                { ext: '.xlsx', label: 'Excel', color: '#16a34a' },
                { ext: '.xls',  label: 'Excel 97+', color: '#15803d' },
                { ext: '.csv',  label: 'CSV', color: '#0891b2' },
                { ext: '.json', label: 'JSON', color: '#7c3aed' },
              ].map(({ ext, label, color }) => (
                <div
                  key={ext}
                  className="flex items-center gap-1.5 rounded-[5px] border px-2.5 py-1"
                  style={{ borderColor: '#e2e6ed', background: '#f7f8fa' }}
                >
                  <div className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                  <span className="font-mono text-[10.5px] text-[#4b5563]">{ext}</span>
                  <span className="text-[10.5px] text-[#9ca3af]">{label}</span>
                </div>
              ))}
              <div className="flex-1" />
              <a
                href="/samples/sample-portfolio.xlsx"
                download="sample-portfolio.xlsx"
                className="flex items-center gap-1.5 rounded-[5px] border border-[#cddaf4] bg-[#eaf0fb] px-2.5 py-1 text-[10.5px] font-medium text-[#2756a3] transition-colors hover:bg-[#cddaf4]"
              >
                <svg viewBox="0 0 14 14" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M7 1v8m0 0L4.5 6.5M7 9l2.5-2.5"/><path d="M1.5 11.5h11"/>
                </svg>
                Download demo sample
              </a>
            </div>

            {/* Trust row */}
            <div
              className="flex items-center gap-3 rounded-[9px] border px-4 py-3"
              style={{ borderColor: '#e2e6ed', background: '#f7f8fa' }}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] border border-emerald-200 bg-emerald-50">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-emerald-600">
                  <path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm3.4 5.8l-4 4.7c-.2.2-.5.3-.7.3-.2 0-.4-.1-.6-.2L4 8.6l1.1-1.2 1.9 1.8 3.4-4 1.1 1.1.9-.5z"/>
                </svg>
              </div>
              <div>
                <div className="text-[11.5px] font-semibold text-[#0d1117]">Your data stays private</div>
                <div className="text-[10.5px] text-[#9ca3af]">Parsed on your private backend · never shared with third parties</div>
              </div>
            </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
