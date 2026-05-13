import { useEffect, useRef, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChevronRight } from 'lucide-react'
import { sendMessage } from '../api'
import type { ToolCall } from '../types'

const MIN_WIDTH = 280
const MAX_WIDTH = 700
const DEFAULT_WIDTH = 340

interface PanelMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  tool_calls?: ToolCall[]
  chips?: string[]
}

interface Props {
  open: boolean
  title?: string
  onClose: () => void
  /** Initial prompt to auto-send when panel opens */
  initialPrompt?: string
  /** Initial assistant content to display without calling /chat */
  initialAssistantMessage?: string
  initialToolCalls?: ToolCall[]
}

function newId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }

const TOOL_CHIPS: Record<string, string[]> = {
  irr:      ['Fee decomp','Sensitivity','MOIC'],
  amort:    ['Early repay','Rate change','Add PIK'],
  restr:    ['Compare all','IRR impact','Memo'],
  impact:   ['Extension','Rate step-up'],
  cov:      ['Breach remediation','Waiver'],
  default:  ['More detail','Compare scenarios','Summary table'],
}

function ToolCallCard({ call }: { call: ToolCall }) {
  const title = call.tool.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  return (
    <details className="group rounded-lg border border-[#e2e6ed] bg-[#f7f8fa] text-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[11px] text-[#4b5563] hover:bg-[#eaf0fb] [&::-webkit-details-marker]:hidden">
        <span className="font-medium text-[#0d1117]">{title}</span>
        <div className="flex items-center gap-1.5">
          {call.duration_ms && <span className="font-mono text-[10px] text-[#9ca3af]">{call.duration_ms}ms</span>}
          <ChevronRight className="h-3 w-3 shrink-0 transition group-open:rotate-90" />
        </div>
      </summary>
      <div className="border-t border-[#e2e6ed] px-3 py-2">
        <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-wide text-[#9ca3af]">Output</p>
        <pre className="max-h-48 overflow-auto rounded border border-[#e2e6ed] bg-white p-2 font-mono text-[10.5px] leading-relaxed text-[#065f46]">
          {(() => { try { return JSON.stringify(call.output, null, 2) } catch { return String(call.output) } })()}
        </pre>
      </div>
    </details>
  )
}

function escapeMarkdownCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()
}

function htmlTableToMarkdown(html: string): string {
  if (typeof DOMParser === 'undefined') return html
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const rows = Array.from(doc.querySelectorAll('tr')).map((row) =>
    Array.from(row.querySelectorAll('th,td')).map((cell) => escapeMarkdownCell(cell.textContent ?? '')),
  ).filter((cells) => cells.length > 0)

  if (!rows.length) return html

  const width = Math.max(...rows.map((r) => r.length))
  const normalized = rows.map((r) => [...r, ...Array(Math.max(0, width - r.length)).fill('')])
  const header = normalized[0]
  const body = normalized.slice(1)
  const divider = Array(width).fill('---')

  return [
    `| ${header.join(' | ')} |`,
    `| ${divider.join(' | ')} |`,
    ...body.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function normalizeAssistantMarkdown(content: string): string {
  return content.replace(/<table[\s\S]*?<\/table>/gi, (tableHtml) => `\n${htmlTableToMarkdown(tableHtml)}\n`)
}

function MsgMarkdown({ content }: { content: string }) {
  const normalizedContent = normalizeAssistantMarkdown(content)
  return (
    <div className="md-answer text-[12px] leading-relaxed text-[#0d1117]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 list-disc space-y-0.5 pl-4 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 list-decimal space-y-0.5 pl-4 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="text-[#4b5563]">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-[#0d1117]">{children}</strong>,
          h2: ({ children }) => <h2 className="mb-1 text-[12px] font-semibold text-[#0d1117]">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-1 text-[11.5px] font-semibold text-[#4b5563]">{children}</h3>,
          table: ({ children }) => (
            <div className="mb-2 overflow-x-auto rounded border border-[#e2e6ed]">
              <table className="w-full border-collapse text-left text-[10.5px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead style={{ background: '#eaf0fb', color: '#1e3f7a' }}>{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr className="border-b border-[#e2e6ed] last:border-0">{children}</tr>,
          th: ({ children }) => <th className="px-2 py-1.5 font-medium">{children}</th>,
          td: ({ children }) => <td className="px-2 py-1.5 text-[#4b5563]">{children}</td>,
          code: ({ children }) => <code className="rounded bg-[#eaf0fb] px-1 py-0.5 font-mono text-[10px] text-[#1e3f7a]">{children}</code>,
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  )
}

export function ChatPanel({ open, title = 'Analysis', onClose, initialPrompt, initialAssistantMessage, initialToolCalls }: Props) {
  const [messages, setMessages] = useState<PanelMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastInitialRef = useRef<string | undefined>(undefined)
  const lastAssistantRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMsg = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    const uid = newId()
    const aid = newId()
    setMessages((m) => [...m, { id: uid, role: 'user', content: trimmed }, { id: aid, role: 'assistant', content: '' }])
    setInput('')
    setBusy(true)
    try {
      const res = await sendMessage(trimmed)
      const chips = TOOL_CHIPS['default']
      setMessages((m) =>
        m.map((row) =>
          row.id === aid ? { ...row, content: res.answer, tool_calls: res.tool_calls, chips } : row,
        ),
      )
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error'
      setMessages((m) => m.map((row) => row.id === aid ? { ...row, content: `Error: ${msg}` } : row))
    } finally {
      setBusy(false)
    }
  }, [busy])

  // Auto-send initial prompt when panel opens
  useEffect(() => {
    if (open && initialPrompt && initialPrompt !== lastInitialRef.current) {
      lastInitialRef.current = initialPrompt
      setMessages([])
      void sendMsg(initialPrompt)
    }
  }, [open, initialPrompt, sendMsg])

  useEffect(() => {
    if (open && initialAssistantMessage && initialAssistantMessage !== lastAssistantRef.current) {
      lastAssistantRef.current = initialAssistantMessage
      setMessages([{
        id: newId(),
        role: 'assistant',
        content: initialAssistantMessage,
        tool_calls: initialToolCalls,
        chips: TOOL_CHIPS.default,
      }])
    }
  }, [open, initialAssistantMessage, initialToolCalls])

  // Clear messages when panel closed
  useEffect(() => {
    if (!open) {
      setTimeout(() => { if (!open) { setMessages([]); lastInitialRef.current = undefined } }, 300)
      lastAssistantRef.current = undefined
    }
  }, [open])

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 72) + 'px'
  }

  // ── Resize handle ────────────────────────────────────────────────
  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH)
  const dragRef = useRef<{ startX: number; startW: number } | null>(null)

  const onDragStart = useCallback((e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startW: panelWidth }
  }, [panelWidth])

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return
    const delta = dragRef.current.startX - e.clientX   // dragging left = wider
    const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragRef.current.startW + delta))
    setPanelWidth(next)
  }, [])

  const onDragEnd = useCallback(() => { dragRef.current = null }, [])

  return (
    <div
      className={`chat-panel ${open ? 'open' : ''} relative flex flex-col border-l bg-white`}
      style={{
        borderColor: '#e2e6ed',
        ...(open ? {
          width: panelWidth,
          minWidth: panelWidth,
          maxWidth: panelWidth,
          transition: dragRef.current ? 'none' : undefined,
        } : {}),
      }}
    >
      {/* Drag-to-resize handle on left edge */}
      {open && (
        <div
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          className="group absolute inset-y-0 left-0 z-10 flex w-[5px] cursor-col-resize items-center justify-center"
          title="Drag to resize"
        >
          {/* Visual grip line */}
          <div className="h-12 w-[3px] rounded-full bg-[#d0d5df] transition-colors group-hover:bg-[#4f9cf9] group-active:bg-[#2756a3]" />
        </div>
      )}
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3" style={{ borderColor: '#e2e6ed' }}>
        <div className="flex h-6 w-6 items-center justify-center rounded-[5px]"
             style={{ background: '#162d5e' }}>
          <svg viewBox="0 0 24 24" className="h-3 w-3 fill-white">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
        <span className="flex-1 truncate text-[12.5px] font-medium text-[#0d1117]">{title}</span>
        {busy && (
          <span className="rounded-[5px] border border-[#cddaf4] bg-[#eaf0fb] px-2 py-0.5 font-mono text-[9.5px] text-[#2756a3]">
            thinking…
          </span>
        )}
        <button type="button" onClick={onClose}
          className="ml-1 rounded p-0.5 text-lg leading-none text-[#9ca3af] hover:text-[#0d1117]">×</button>
      </div>

      {/* Messages */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2.5">
        {messages.length === 0 && !busy && (
          <div className="flex flex-1 items-center justify-center px-4 text-center">
            <p className="text-[11.5px] text-[#9ca3af]">Ask a question about this deal or the portfolio…</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`msg-anim flex gap-1.5 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[9.5px] font-semibold ${
              m.role === 'assistant' ? 'bg-[#162d5e] text-white' : 'border border-[#e2e6ed] bg-[#f7f8fa] text-[#4b5563]'
            }`}>
              {m.role === 'assistant' ? 'N' : 'You'}
            </div>
            <div className={`max-w-[86%] rounded-[11px] px-3 py-2 text-[12px] leading-relaxed ${
              m.role === 'user'
                ? 'rounded-tr-[3px] bg-[#162d5e] text-white'
                : 'rounded-tl-[3px] border border-[#e2e6ed] bg-white text-[#0d1117]'
            }`}>
              {m.content ? (
                m.role === 'assistant' ? <MsgMarkdown content={m.content} /> : m.content
              ) : (
                <span className="inline-flex gap-1 py-0.5">
                  <span className="ldot" /><span className="ldot" /><span className="ldot" />
                </span>
              )}
              {m.tool_calls && m.tool_calls.length > 0 && (
                <div className="mt-2 space-y-1">
                  {m.tool_calls.map((c, i) => <ToolCallCard key={i} call={c} />)}
                </div>
              )}
              {m.chips && m.chips.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {m.chips.map((chip) => (
                    <button key={chip} type="button" onClick={() => void sendMsg(chip)} className="chip">
                      {chip}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="flex shrink-0 gap-1.5 border-t p-2.5" style={{ borderColor: '#e2e6ed' }}>
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          placeholder="Ask a question…"
          disabled={busy}
          onChange={(e) => { setInput(e.target.value); autoResize(e.target) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMsg(input) }
          }}
          className="flex-1 resize-none rounded-[5px] border bg-[#f7f8fa] px-2.5 py-1.5 text-[12px] text-[#0d1117] outline-none transition-colors placeholder:text-[#9ca3af] focus:border-[#3d72c8] focus:bg-white disabled:opacity-50"
          style={{ borderColor: '#d0d5df', maxHeight: 72, lineHeight: 1.45 }}
        />
        <button
          type="button"
          disabled={busy || !input.trim()}
          onClick={() => void sendMsg(input)}
          className="flex h-8 w-8 shrink-0 items-center justify-center self-end rounded-[5px] transition-colors disabled:opacity-40"
          style={{ background: '#162d5e' }}
          onMouseEnter={(e) => { if (!busy) e.currentTarget.style.background = '#0f2044' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#162d5e' }}
        >
          <svg viewBox="0 0 16 16" className="h-3 w-3 fill-white">
            <path d="M2 8l12-6-4 6 4 6L2 8z"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

