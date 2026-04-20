'use client'

import { useState } from 'react'
import { Menu, Sparkles, X } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { AIAssistant } from '@/components/assistant/AIAssistant'

interface Props {
  title: string
  actions?: React.ReactNode
  children: React.ReactNode
}

export function AppShell({ title, actions, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [chatOpen, setChatOpen]       = useState(false)

  return (
    <div className="flex h-screen bg-slate-50/60 dark:bg-slate-950 overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-60 transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:relative lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl px-4 sm:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden rounded-lg p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{title}</h1>
          {actions && (
            <div className="ml-auto flex items-center gap-2">
              {actions}
            </div>
          )}
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* ── Floating AI chat widget ──────────────────────────────── */}

      {/* Chat panel */}
      <div
        className={`fixed bottom-24 right-6 z-50 w-[370px] max-w-[calc(100vw-2rem)] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          chatOpen
            ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
            : 'opacity-0 translate-y-6 scale-95 pointer-events-none'
        }`}
      >
        <div
          className="glass shadow-2xl rounded-2xl overflow-hidden glow-teal"
          style={{ height: '520px' }}
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-teal-500/20 bg-gradient-to-r from-teal-600 to-emerald-600">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-white/20 blur-sm animate-pulse-glow" />
                <Sparkles className="relative h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white leading-none">Grocery AI</p>
                <p className="text-[10px] text-teal-100 mt-0.5">Answers from your real data</p>
              </div>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              className="text-teal-200 hover:text-white transition-colors rounded-lg p-1 hover:bg-white/20 active:scale-90"
              aria-label="Close AI assistant"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Chat body */}
          <div className="h-[calc(520px-52px)]">
            {chatOpen && <AIAssistant compact />}
          </div>
        </div>
      </div>

      {/* FAB trigger button */}
      <button
        onClick={() => setChatOpen((v) => !v)}
        aria-label={chatOpen ? 'Close AI assistant' : 'Open AI assistant'}
        className={`fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-90 ${
          chatOpen
            ? 'bg-slate-700 hover:bg-slate-800 rotate-90 scale-90 shadow-lg'
            : 'bg-gradient-to-br from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 hover:scale-110 glow-teal'
        }`}
      >
        {chatOpen
          ? <X className="h-5 w-5 text-white" />
          : <Sparkles className="h-5 w-5 text-white" />
        }
      </button>
    </div>
  )
}
