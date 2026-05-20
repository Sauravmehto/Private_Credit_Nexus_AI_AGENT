import { useEffect, useRef, useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChevronRight } from 'lucide-react'
import { sendMessage } from '../api'
import type { ToolCall } from '../types'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

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
  initialPrompt?: string
  initialAssistantMessage?: string
  initialToolCalls?: ToolCall[]
}

function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

const TOOL_CHIPS: Record<string, string[]> = {
  irr: ['Fee decomp', 'Sensitivity', 'MOIC'],
  amort: ['Early repay', 'Rate change', 'Add PIK'],
  restr: ['Compare all', 'IRR impact', 'Memo'],
  impact: ['Extension', 'Rate step-up'],
  cov: ['Breach remediation', 'Waiver'],
  default: ['More detail', 'Compare scenarios', 'Summary table'],
}

function ToolCallCard({ call }: { call: ToolCall }) {
  const title = call.tool
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  return (
    <details className="group rounded-lg border border-border bg-muted/40 text-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[11px] text-muted-foreground hover:bg-muted/60 [&::-webkit-details-marker]:hidden">
        <span className="font-medium text-foreground">{title}</span>
        <div className="flex items-center gap-1.5">
          {call.duration_ms && (
            <span className="font-mono text-[10px] text-muted-foreground">{call.duration_ms}ms</span>
          )}
          <ChevronRight className="h-3 w-3 shrink-0 transition group-open:rotate-90" />
        </div>
      </summary>
      <div className="border-t border-border px-3 py-2">
        <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">Output</p>
        <pre className="max-h-48 overflow-auto rounded border border-border bg-background p-2 font-mono text-[10.5px] leading-relaxed text-emerald-800">
          {(() => {
            try {
              return JSON.stringify(call.output, null, 2)
            } catch {
              return String(call.output)
            }
          })()}
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
    <div className="md-answer text-[12px] leading-relaxed text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 list-disc space-y-0.5 pl-4 last:mb-0">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 list-decimal space-y-0.5 pl-4 last:mb-0">{children}</ol>,
          li: ({ children }) => <li className="text-muted-foreground">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
          h2: ({ children }) => <h2 className="mb-1 text-sm font-semibold text-foreground">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-1 text-[11.5px] font-semibold text-muted-foreground">{children}</h3>,
          table: ({ children }) => (
            <div className="mb-2 overflow-x-auto rounded-md border border-border">
              <table className="w-full border-collapse text-left text-[10.5px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-primary/10 text-primary">{children}</thead>
          ),
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr className="border-b border-border last:border-0">{children}</tr>,
          th: ({ children }) => <th className="px-2 py-1.5 font-medium">{children}</th>,
          td: ({ children }) => <td className="px-2 py-1.5 text-muted-foreground">{children}</td>,
          code: ({ children }) => (
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px] text-primary">{children}</code>
          ),
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  )
}

export function ChatPanel({
  open,
  title = 'Analysis',
  onClose,
  initialPrompt,
  initialAssistantMessage,
  initialToolCalls,
}: Props) {
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

  const sendMsg = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || busy) return
      const uid = newId()
      const aid = newId()
      setMessages((m) => [
        ...m,
        { id: uid, role: 'user', content: trimmed },
        { id: aid, role: 'assistant', content: '' },
      ])
      setInput('')
      setBusy(true)
      try {
        const res = await sendMessage(trimmed)
        const chips = TOOL_CHIPS.default
        setMessages((m) =>
          m.map((row) =>
            row.id === aid ? { ...row, content: res.answer, tool_calls: res.tool_calls, chips } : row,
          ),
        )
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Error'
        setMessages((m) => m.map((row) => (row.id === aid ? { ...row, content: `Error: ${msg}` } : row)))
      } finally {
        setBusy(false)
      }
    },
    [busy],
  )

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
      setMessages([
        {
          id: newId(),
          role: 'assistant',
          content: initialAssistantMessage,
          tool_calls: initialToolCalls,
          chips: TOOL_CHIPS.default,
        },
      ])
    }
  }, [open, initialAssistantMessage, initialToolCalls])

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        if (!open) {
          setMessages([])
          lastInitialRef.current = undefined
        }
      }, 300)
      lastAssistantRef.current = undefined
    }
  }, [open])

  function autoResize(el: HTMLTextAreaElement) {
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 72)}px`
  }

  const [panelWidth, setPanelWidth] = useState(DEFAULT_WIDTH)
  const dragRef = useRef<{ startX: number; startW: number } | null>(null)

  const onDragStart = useCallback(
    (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId)
      dragRef.current = { startX: e.clientX, startW: panelWidth }
    },
    [panelWidth],
  )

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return
    const delta = dragRef.current.startX - e.clientX
    const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragRef.current.startW + delta))
    setPanelWidth(next)
  }, [])

  const onDragEnd = useCallback(() => {
    dragRef.current = null
  }, [])

  return (
    <div
      className={cn('chat-panel relative flex flex-col border-l border-border bg-card', open && 'open')}
      style={{
        ...(open
          ? {
              width: panelWidth,
              minWidth: panelWidth,
              maxWidth: panelWidth,
              transition: dragRef.current ? 'none' : undefined,
            }
          : {}),
      }}
    >
      {open && (
        <div
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          className="group absolute inset-y-0 left-0 z-10 flex w-[5px] cursor-col-resize items-center justify-center"
          title="Drag to resize"
        >
          <div className="h-12 w-[3px] rounded-full bg-border transition-colors group-hover:bg-primary group-active:bg-primary/80" />
        </div>
      )}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
        <Avatar className="h-7 w-7 rounded-md">
          <AvatarFallback className="rounded-md bg-primary text-[10px] font-semibold text-primary-foreground">
            AI
          </AvatarFallback>
        </Avatar>
        <span className="flex-1 truncate text-sm font-medium text-foreground">{title}</span>
        {busy && (
          <span className="rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 font-mono text-[9.5px] text-primary">
            thinking…
          </span>
        )}
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose} aria-label="Close chat">
          ×
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 p-2.5">
          {messages.length === 0 && !busy && (
            <div className="flex flex-1 items-center justify-center px-4 py-8 text-center">
              <p className="text-[11.5px] text-muted-foreground">Ask a question about this deal or the portfolio…</p>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={cn('msg-anim flex gap-2', m.role === 'user' ? 'flex-row-reverse' : '')}>
              <Avatar className="mt-0.5 h-7 w-7 shrink-0">
                <AvatarFallback
                  className={cn(
                    'text-[10px] font-semibold',
                    m.role === 'assistant' ? 'bg-primary text-primary-foreground' : 'border border-border bg-muted',
                  )}
                >
                  {m.role === 'assistant' ? 'AI' : 'You'}
                </AvatarFallback>
              </Avatar>
              <div
                className={cn(
                  'max-w-[86%] rounded-lg px-3 py-2 text-sm leading-relaxed',
                  m.role === 'user'
                    ? 'rounded-tr-sm bg-primary text-primary-foreground'
                    : 'rounded-tl-sm border border-border bg-background text-foreground',
                )}
              >
                {m.content ? (
                  m.role === 'assistant' ? (
                    <MsgMarkdown content={m.content} />
                  ) : (
                    m.content
                  )
                ) : (
                  <div className="flex gap-1 py-0.5" aria-busy="true" aria-label="Assistant is typing">
                    <Skeleton className="h-2 w-2 rounded-full" />
                    <Skeleton className="h-2 w-2 rounded-full" />
                    <Skeleton className="h-2 w-2 rounded-full" />
                  </div>
                )}
                {m.tool_calls && m.tool_calls.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {m.tool_calls.map((c, i) => (
                      <ToolCallCard key={i} call={c} />
                    ))}
                  </div>
                )}
                {m.chips && m.chips.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.chips.map((chip) => (
                      <Button
                        key={chip}
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-7 text-[11px]"
                        onClick={() => void sendMsg(chip)}
                      >
                        {chip}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      </ScrollArea>

      <Separator />

      <div className="flex shrink-0 gap-2 p-2.5">
        <Textarea
          ref={textareaRef}
          rows={1}
          value={input}
          placeholder="Ask a question…"
          disabled={busy}
          onChange={(e) => {
            setInput(e.target.value)
            autoResize(e.target)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void sendMsg(input)
            }
          }}
          className="min-h-[36px] max-h-[72px] flex-1 resize-none text-sm leading-snug"
        />
        <Button
          type="button"
          size="icon"
          disabled={busy || !input.trim()}
          className="h-9 w-9 shrink-0 self-end"
          onClick={() => void sendMsg(input)}
          aria-label="Send message"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-primary-foreground">
            <path d="M2 8l12-6-4 6 4 6L2 8z" />
          </svg>
        </Button>
      </div>
    </div>
  )
}
