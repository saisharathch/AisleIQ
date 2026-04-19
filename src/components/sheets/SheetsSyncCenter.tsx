'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import {
  CheckCircle2, XCircle, AlertCircle, Loader2, RefreshCw,
  ExternalLink, Sheet, Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SyncCount { synced: number; notSynced: number; failed: number; stale: number }

interface RecentSync {
  id: string
  storeName: string | null
  grandTotal: number | null
  sheetsSyncedAt: Date | null
  sheetsUploadId: string | null
}

interface SheetsStatus {
  status: 'not_connected' | 'missing_scope' | 'token_expired' | 'ok'
  tokenExpiresAt?: number | null
}

interface Props {
  spreadsheetId: string | null
  syncCounts: SyncCount
  recentlySynced: RecentSync[]
}

function ConnectionBadge({ status }: { status: SheetsStatus['status'] | 'loading' }) {
  if (status === 'loading')
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500"><Loader2 className="h-3 w-3 animate-spin" />Checking…</span>
  if (status === 'ok')
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700"><CheckCircle2 className="h-3 w-3" />Connected</span>
  if (status === 'not_connected')
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500"><XCircle className="h-3 w-3" />Not connected</span>
  if (status === 'missing_scope')
    return <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700"><AlertCircle className="h-3 w-3" />Missing permission</span>
  return <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-600"><XCircle className="h-3 w-3" />Token expired</span>
}

export function SheetsSyncCenter({ spreadsheetId, syncCounts, recentlySynced }: Props) {
  const router = useRouter()
  const [sheetsStatus, setSheetsStatus] = useState<SheetsStatus['status'] | 'loading'>('loading')
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    fetch('/api/sheets/status')
      .then((r) => r.json())
      .then((d) => setSheetsStatus(d.status))
      .catch(() => setSheetsStatus('not_connected'))
  }, [])

  async function syncAll() {
    setSyncing(true)
    // Get all done receipts and sync pending ones
    try {
      const res = await fetch('/api/receipts?status=done&limit=50')
      if (!res.ok) throw new Error('Failed to fetch receipts')
      const data = await res.json()
      const receipts: { id: string }[] = (data.data ?? []).filter(
        (r: { syncStatus?: string }) => r.syncStatus !== 'synced'
      )

      if (receipts.length === 0) {
        toast('All receipts are already synced!')
        setSyncing(false)
        return
      }

      let success = 0; let failed = 0
      for (const r of receipts) {
        const syncRes = await fetch(`/api/receipts/${r.id}/sheets`, { method: 'POST' })
        if (syncRes.ok) success++; else failed++
      }

      if (failed > 0) toast.error(`${success} synced, ${failed} failed`)
      else toast.success(`${success} receipt${success !== 1 ? 's' : ''} synced to Sheets!`)
      router.refresh()
    } catch {
      toast.error('Sync failed — check your connection')
    } finally {
      setSyncing(false)
    }
  }

  const totalPending = syncCounts.notSynced + syncCounts.stale + syncCounts.failed

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-base font-semibold text-slate-900">Google Sheets</h1>
        <p className="text-xs text-slate-400 mt-0.5">Sync your receipts to a Google Sheets spreadsheet</p>
      </div>

      {/* Connection card */}
      <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 shrink-0">
              <Sheet className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Google Account</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {spreadsheetId ? `Spreadsheet ID: ${spreadsheetId.slice(0, 12)}…` : 'No spreadsheet linked yet'}
              </p>
            </div>
          </div>
          <ConnectionBadge status={sheetsStatus} />
        </div>

        {sheetsStatus !== 'ok' && sheetsStatus !== 'loading' && (
          <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700">
            {sheetsStatus === 'not_connected'
              ? 'Sign in with Google on the sign-in page to enable Sheets sync.'
              : sheetsStatus === 'missing_scope'
              ? 'Re-connect your Google account to grant spreadsheet access.'
              : 'Your Google session expired. Please sign in again.'}
          </div>
        )}

        {sheetsStatus === 'ok' && spreadsheetId && (
          <div className="mt-4">
            <a
              href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-teal-600 hover:text-teal-700 font-medium"
            >
              Open spreadsheet <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>

      {/* Sync stats */}
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: 'Synced', count: syncCounts.synced, color: 'emerald' },
          { label: 'Pending', count: syncCounts.notSynced, color: 'slate' },
          { label: 'Stale', count: syncCounts.stale, color: 'amber' },
          { label: 'Failed', count: syncCounts.failed, color: 'rose' },
        ].map(({ label, count, color }) => (
          <div key={label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm text-center">
            <p className={`text-2xl font-bold text-${color}-600`}>{count}</p>
            <p className="text-xs text-slate-400 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Sync actions */}
      {sheetsStatus === 'ok' && totalPending > 0 && (
        <div className="rounded-xl border border-teal-100 bg-teal-50/50 p-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {totalPending} receipt{totalPending !== 1 ? 's' : ''} not synced
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Click to sync all pending receipts to Google Sheets</p>
            </div>
            <Button
              onClick={syncAll} disabled={syncing}
              className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
            >
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Sync All
            </Button>
          </div>
        </div>
      )}

      {/* Recent syncs */}
      <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Recent Syncs</h3>
        {recentlySynced.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">No synced receipts yet</p>
        ) : (
          <div className="space-y-1">
            {recentlySynced.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-slate-700 truncate block">
                    {r.storeName ?? 'Unknown Store'}
                  </span>
                </div>
                {r.grandTotal != null && (
                  <span className="text-xs font-semibold text-slate-700 shrink-0">${r.grandTotal.toFixed(2)}</span>
                )}
                <span className="text-[10px] text-slate-400 shrink-0 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {r.sheetsSyncedAt
                    ? formatDistanceToNow(new Date(r.sheetsSyncedAt), { addSuffix: true })
                    : '—'}
                </span>
                <Link href={`/receipts/${r.id}`} className="text-slate-300 hover:text-teal-500 transition-colors shrink-0">
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
