/**
 * Legacy full-page chat thread — kept for reference.
 * Active chat UI is now in ChatPanel.tsx (slide-in side panel).
 */
import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChevronRight } from 'lucide-react'
import type { ChatMessage, ToolCall } from '../types'

function humanizeToolName(toolId: string): string {
  return toolId.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

function formatJson(value: unknown): string {
  try { return JSON.stringify(value, null, 2) } catch { return String(value) }
}

function ToolCallCard({ call }: { call: ToolCall }) {
  const title = humanizeToolName(call.tool)
  return (
    <details className="group rounded-lg border border-[#e2e6ed] bg-[#f7f8fa]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[11px] text-[#4b5563] hover:bg-[#eaf0fb] [&::-webkit-details-marker]:hidden">
        <span className="font-medium text-[#0d1117]">{title}</span>
        <div className="flex items-center gap-1.5">
          {call.duration_ms != null && <span className="font-mono text-[10px] text-[#9ca3af]">{call.duration_ms}ms</span>}
          <ChevronRight className="h-3 w-3 shrink-0 transition group-open:rotate-90" />
        </div>
      </summary>
      <div className="border-t border-[#e2e6ed] px-3 py-2">
        <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-wide text-[#9ca3af]">Output</p>
        <pre className="max-h-48 overflow-auto rounded border border-[#e2e6ed] bg-white p-2 font-mono text-[10.5px] leading-relaxed text-[#065f46]">
          {formatJson(call.output)}
        </pre>
      </div>
      <details className="group/inner border-t border-[#e2e6ed]">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 px-3 py-1.5 text-[11px] text-[#9ca3af] hover:bg-[#f7f8fa] [&::-webkit-details-marker]:hidden">
          <ChevronRight className="h-3 w-3 shrink-0 transition group-open/inner:rotate-90" />
          Tool input
        </summary>
        <pre className="max-h-32 overflow-auto px-3 pb-2 font-mono text-[10px] text-[#9ca3af]">
          {formatJson(call.input)}
        </pre>
      </details>
    </details>
  )
}

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="md-answer text-[12px] leading-relaxed text-[#0d1117]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 list-disc space-y-0.5 pl-4">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 list-decimal space-y-0.5 pl-4">{children}</ol>,
          li: ({ children }) => <li className="text-[#4b5563]">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-[#0d1117]">{children}</strong>,
          h2: ({ children }) => <h2 className="mb-1 text-[13px] font-semibold text-[#0d1117]">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-1 text-[12px] font-semibold">{children}</h3>,
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
          code: ({ children }) => <code className="rounded bg-[#eaf0fb] px-1 font-mono text-[10px] text-[#1e3f7a]">{children}</code>,
          pre: ({ children }) => <pre className="mb-2 overflow-x-auto">{children}</pre>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export function ChatThread({ messages }: { messages: ChatMessage[] }) {
  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto bg-[#f7f8fa] px-5 py-5">
      {messages.length === 0 && (
        <div className="mx-auto max-w-lg rounded-xl border border-dashed border-[#d0d5df] bg-white px-6 py-10 text-center">
          <p className="text-[14px] font-medium text-[#0d1117]">Private credit analyst</p>
          <p className="mt-1.5 text-[12px] text-[#9ca3af]">
            Ask questions about deals, IRR, covenants, and restructuring.
          </p>
        </div>
      )}
      {messages.map((m) => (
        <div key={m.id} className={`msg-anim flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[9.5px] font-semibold ${
            m.role === 'assistant' ? 'bg-[#162d5e] text-white' : 'border border-[#e2e6ed] bg-[#f7f8fa] text-[#4b5563]'
          }`}>
            {m.role === 'assistant' ? 'N' : 'U'}
          </div>
          <div className={`max-w-[86%] rounded-[11px] px-3 py-2 text-[12px] ${
            m.role === 'user'
              ? 'rounded-tr-[3px] bg-[#162d5e] text-white'
              : 'rounded-tl-[3px] border border-[#e2e6ed] bg-white text-[#0d1117]'
          }`}>
            {m.role === 'user' ? (
              <span className="whitespace-pre-wrap">{m.content}</span>
            ) : m.content ? (
              <AssistantMarkdown content={m.content} />
            ) : (
              <span className="inline-flex gap-1 py-0.5">
                <span className="ldot" /><span className="ldot" /><span className="ldot" />
              </span>
            )}
            {m.tool_calls && m.tool_calls.length > 0 && (
              <details className="group mt-2 overflow-hidden rounded-lg border border-[#e2e6ed]">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[11px] text-[#4b5563] hover:bg-[#f7f8fa] [&::-webkit-details-marker]:hidden">
                  <span>Tool calls ({m.tool_calls.length})</span>
                  <ChevronRight className="h-3 w-3 shrink-0 transition group-open:rotate-90" />
                </summary>
                <div className="space-y-2 border-t border-[#e2e6ed] p-2">
                  {m.tool_calls.map((c, i) => <ToolCallCard key={i} call={c} />)}
                </div>
              </details>
            )}
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  )
}
