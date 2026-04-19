'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Sparkles, RotateCcw, AlertCircle, TrendingUp, ShoppingCart, BarChart2, Users, Target, Receipt } from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  error?: boolean
  intent?: string
  loading?: boolean
}

// ─── Suggested prompts ────────────────────────────────────────────────────

const SUGGESTED = [
  { icon: TrendingUp,   text: 'How much did I spend this month?',                  color: 'teal' },
  { icon: BarChart2,    text: 'What are my top spending categories?',               color: 'violet' },
  { icon: ShoppingCart, text: 'Which store did I spend the most at?',              color: 'blue' },
  { icon: RotateCcw,    text: 'What are my most recurring grocery items?',          color: 'amber' },
  { icon: TrendingUp,   text: 'Did I spend more this month than last month?',       color: 'emerald' },
  { icon: Receipt,      text: "What's my average grocery trip cost?",              color: 'slate' },
  { icon: Target,       text: 'Show me my budget status.',                          color: 'rose' },
  { icon: Users,        text: 'Show me the roommate split totals.',                 color: 'orange' },
]

const COLOR_MAP: Record<string, string> = {
  teal:    'bg-teal-50 border-teal-100 text-teal-700 hover:bg-teal-100',
  violet:  'bg-violet-50 border-violet-100 text-violet-700 hover:bg-violet-100',
  blue:    'bg-blue-50 border-blue-100 text-blue-700 hover:bg-blue-100',
  amber:   'bg-amber-50 border-amber-100 text-amber-700 hover:bg-amber-100',
  emerald: 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100',
  slate:   'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100',
  rose:    'bg-rose-50 border-rose-100 text-rose-700 hover:bg-rose-100',
  orange:  'bg-orange-50 border-orange-100 text-orange-700 hover:bg-orange-100',
}

// ─── Typing indicator ─────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 shrink-0 shadow-sm">
        <Sparkles className="h-3.5 w-3.5 text-white" />
      </div>
      <div className="rounded-2xl rounded-bl-sm bg-white border border-slate-100 shadow-sm px-4 py-3">
        <div className="flex gap-1.5 items-center h-5">
          <span className="h-2 w-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="h-2 w-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="h-2 w-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}

// ─── Message bubble ───────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-teal-600 px-4 py-3 text-sm text-white leading-relaxed shadow-sm">
          {msg.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-end gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 shrink-0 shadow-sm self-start mt-0.5">
        <Sparkles className="h-3.5 w-3.5 text-white" />
      </div>
      <div className={`max-w-[82%] rounded-2xl rounded-bl-sm border shadow-sm px-4 py-3 text-sm leading-relaxed ${
        msg.error
          ? 'bg-rose-50 border-rose-100 text-rose-700'
          : 'bg-white border-slate-100 text-slate-700'
      }`}>
        {msg.error && (
          <div className="flex items-center gap-1.5 mb-1.5 text-rose-600 font-medium">
            <AlertCircle className="h-3.5 w-3.5" />
            <span className="text-xs">Something went wrong</span>
          </div>
        )}
        <FormattedResponse text={msg.content} />
      </div>
    </div>
  )
}

// Renders **bold** and line breaks nicely
function FormattedResponse({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} className="font-semibold text-slate-900">{part.slice(2, -2)}</strong>
        }
        return part.split('\n').map((line, j) => (
          <span key={`${i}-${j}`}>
            {j > 0 && <br />}
            {line}
          </span>
        ))
      })}
    </span>
  )
}

// ─── Empty state / suggestions ────────────────────────────────────────────

function EmptyState({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 py-8">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-lg">
          <Sparkles className="h-7 w-7 text-white" />
        </div>
        <h2 className="text-base font-semibold text-slate-900">Grocery AI Assistant</h2>
        <p className="text-xs text-slate-400 mt-1.5 max-w-xs">
          Ask me anything about your grocery spending. I only use your real data — no guessing.
        </p>
      </div>

      <div className="w-full max-w-lg">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-3 text-center">
          Suggested questions
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {SUGGESTED.map((s) => {
            const cls = COLOR_MAP[s.color] ?? COLOR_MAP.slate
            return (
              <button
                key={s.text}
                onClick={() => onSelect(s.text)}
                className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left text-xs font-medium transition-all hover:shadow-sm ${cls}`}
              >
                <s.icon className="h-3.5 w-3.5 shrink-0" />
                {s.text}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────

interface AIAssistantProps {
  /** When true, hides the internal header (used inside AppShell's floating panel) */
  compact?: boolean
}

export function AIAssistant({ compact = false }: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const bottomRef               = useRef<HTMLDivElement>(null)
  const inputRef                = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = useCallback(async (question: string) => {
    const q = question.trim()
    if (!q || loading) return

    const userMsg: Message = {
      id:   crypto.randomUUID(),
      role: 'user',
      content: q,
    }

    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai-assistant', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ question: q }),
      })

      const json = await res.json()

      const assistantMsg: Message = {
        id:      crypto.randomUUID(),
        role:    'assistant',
        content: res.ok ? json.answer : (json.error ?? 'Something went wrong. Please try again.'),
        error:   !res.ok,
        intent:  json.intent,
      }

      setMessages((prev) => [...prev, assistantMsg])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id:      crypto.randomUUID(),
          role:    'assistant',
          content: 'Network error. Please check your connection and try again.',
          error:   true,
        },
      ])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [loading])

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  function clearChat() {
    setMessages([])
    setInput('')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const isEmpty = messages.length === 0 && !loading

  return (
    <div className="flex flex-col h-full">
      {/* Header — only shown on the full /assistant page, not in the compact FAB panel */}
      {!compact && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white/80 backdrop-blur shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 leading-none">Grocery AI</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Answers from your real data only</p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" /> Clear
            </button>
          )}
        </div>
      )}

      {/* Compact clear button */}
      {compact && messages.length > 0 && (
        <div className="flex justify-end px-3 pt-2 shrink-0">
          <button
            onClick={clearChat}
            className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1"
          >
            <RotateCcw className="h-3 w-3" /> Clear
          </button>
        </div>
      )}

      {/* Messages / Empty state */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="h-full px-4">
            <EmptyState onSelect={(text) => sendMessage(text)} />
          </div>
        ) : (
          <div className="px-4 py-4 space-y-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}
            {loading && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-slate-100 bg-white px-4 py-3">
        <div className={`flex items-end gap-2 rounded-xl border bg-slate-50 px-3 py-2 transition-all ${
          loading ? 'opacity-60' : 'focus-within:border-teal-400 focus-within:ring-2 focus-within:ring-teal-500/20'
        }`}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about your spending…"
            rows={1}
            disabled={loading}
            className="flex-1 resize-none bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none min-h-[24px] max-h-32 leading-6"
            style={{ height: 'auto' }}
            onInput={(e) => {
              const t = e.currentTarget
              t.style.height = 'auto'
              t.style.height = `${Math.min(t.scrollHeight, 128)}px`
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            className={`mb-0.5 flex h-7 w-7 items-center justify-center rounded-lg transition-all shrink-0 ${
              input.trim() && !loading
                ? 'bg-teal-600 text-white hover:bg-teal-700 shadow-sm'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
            aria-label="Send"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-slate-300 text-center mt-2">
          Shift + Enter for newline · Enter to send
        </p>
      </div>
    </div>
  )
}
