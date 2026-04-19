'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { User, Sheet, Tag, CheckCircle2, XCircle, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'

interface CategoryPref {
  id: string
  normalizedName: string
  category: string
  usageCount: number
}

interface Props {
  name: string
  email: string
  spreadsheetId: string | null
  sheetsConnected: boolean
  memberSince: string | null
  categoryPrefs: CategoryPref[]
}

function Section({ title, description, icon: Icon, children }: {
  title: string; description?: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 shrink-0">
          <Icon className="h-4 w-4 text-slate-500" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

export function SettingsForm({ name, email, spreadsheetId, sheetsConnected, memberSince, categoryPrefs }: Props) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(name)
  const [savingName, setSavingName]   = useState(false)
  const [deletingPref, setDeletingPref] = useState<string | null>(null)

  async function saveName() {
    if (!displayName.trim()) { toast.error('Name cannot be empty'); return }
    setSavingName(true)
    const res = await fetch('/api/user/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: displayName.trim() }),
    })
    setSavingName(false)
    if (res.ok) { toast.success('Name updated'); router.refresh() }
    else toast.error('Failed to update name')
  }

  async function deletePref(id: string) {
    setDeletingPref(id)
    const res = await fetch(`/api/category-preferences/${id}`, { method: 'DELETE' })
    setDeletingPref(null)
    if (res.ok) { toast.success('Preference removed'); router.refresh() }
    else toast.error('Failed to remove preference')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-base font-semibold text-slate-900">Settings</h1>
        <p className="text-xs text-slate-400 mt-0.5">Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <Section title="Profile" description="Your account details" icon={User}>
        <div className="space-y-4">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Display Name
            </label>
            <div className="flex gap-2">
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && saveName()}
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
              />
              <Button onClick={saveName} disabled={savingName} size="sm" className="bg-teal-600 hover:bg-teal-700 text-white">
                {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </Button>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Email
            </label>
            <p className="text-sm text-slate-600 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">{email}</p>
          </div>
          {memberSince && (
            <p className="text-xs text-slate-400">
              Member since {format(new Date(memberSince), 'MMMM d, yyyy')}
            </p>
          )}
        </div>
      </Section>

      {/* Google Sheets */}
      <Section title="Google Sheets" description="Spreadsheet sync settings" icon={Sheet}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">Connection status:</span>
            {sheetsConnected
              ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />Connected</span>
              : <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-400"><XCircle className="h-3.5 w-3.5" />Not connected</span>
            }
          </div>
          {spreadsheetId && (
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Spreadsheet ID
              </label>
              <p className="text-xs text-slate-500 font-mono bg-slate-50 rounded-lg border border-slate-200 px-3 py-2 truncate">
                {spreadsheetId}
              </p>
            </div>
          )}
          {!sheetsConnected && (
            <p className="text-xs text-slate-400">
              Sign in with Google to enable automatic Sheets sync.
            </p>
          )}
        </div>
      </Section>

      {/* Learned categories */}
      <Section
        title="Learned Categorizations"
        description="Auto-applied when similar items are recognized"
        icon={Tag}
      >
        {categoryPrefs.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">
            No learned categories yet. Edit an item's category in a receipt to teach the system.
          </p>
        ) : (
          <div className="space-y-1">
            <div className="grid grid-cols-3 gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2 px-2">
              <span>Item</span><span>Category</span><span>Used</span>
            </div>
            {categoryPrefs.map((pref) => (
              <div key={pref.id} className="group grid grid-cols-3 gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 transition-colors items-center">
                <span className="text-xs text-slate-700 truncate">{pref.normalizedName}</span>
                <span className="inline-flex">
                  <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-700 truncate max-w-[100px]">
                    {pref.category}
                  </span>
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">{pref.usageCount}×</span>
                  <button
                    onClick={() => deletePref(pref.id)}
                    disabled={deletingPref === pref.id}
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-400 transition-all"
                  >
                    {deletingPref === pref.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
