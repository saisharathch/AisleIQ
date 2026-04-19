'use client'

import { useState, useEffect, useCallback } from 'react'
import { ExternalLink, Loader2, Sheet, AlertTriangle, CheckCircle2, RefreshCw, Clock3, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getFriendlyErrorMessage } from '@/lib/api-client'
import { ITEM_CATEGORIES, categorizeItem } from '@/lib/google-sheets'
import type { ReceiptItem } from '@prisma/client'
import type { ReviewStatus, SyncStatus } from '@/types'
import type { SheetsAuthStatus } from '@/app/api/sheets/status/route'

const PREF_KEY = 'sheets_upload_preference'
type Pref = 'ask' | 'never'

interface Props {
  receiptId: string
  storeName: string | null
  items: ReceiptItem[]
  grandTotal: number | null
  alreadyUploaded: boolean
  existingSheetUrl?: string | null
  sheetsSyncedAt?: Date | null
  syncStatus: SyncStatus
  syncErrorMessage?: string | null
  reviewStatus: ReviewStatus
  open: boolean
  onOpenChange: (open: boolean) => void
  onSyncSuccess?: () => void
}

export function GoogleSheetsModal({
  receiptId, storeName, items, grandTotal,
  alreadyUploaded, existingSheetUrl, sheetsSyncedAt,
  syncStatus, syncErrorMessage, reviewStatus,
  open, onOpenChange, onSyncSuccess,
}: Props) {
  const [authStatus, setAuthStatus] = useState<SheetsAuthStatus | null>(null)
  const [categories, setCategories] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)
  const [sheetUrl, setSheetUrl] = useState<string | null>(existingSheetUrl ?? null)
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(sheetsSyncedAt ?? null)

  useEffect(() => {
    if (!open) return
    const initial: Record<string, string> = {}
    for (const item of items) initial[item.id] = item.category ?? categorizeItem(item.item)
    setCategories(initial)
  }, [open, items])

  useEffect(() => {
    if (!open) return
    fetch('/api/sheets/status')
      .then((response) => response.json())
      .then((data: SheetsAuthStatus) => setAuthStatus(data))
      .catch(() => setAuthStatus({ status: 'not_connected' }))
  }, [open])

  const handleUpload = useCallback(async (force = false) => {
    setUploading(true)
    try {
      const res = await fetch(`/api/receipts/${receiptId}/sheets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories, force }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.code === 'ALREADY_SYNCED' && data.sheetUrl) {
          setSheetUrl(data.sheetUrl)
          if (data.syncedAt) setLastSyncedAt(new Date(data.syncedAt))
          toast('Already synced. Use re-sync if you want to push the latest edits.', { icon: '📋' })
        } else if (
          data.code === 'GOOGLE_NOT_CONNECTED' ||
          data.code === 'SHEETS_SCOPE_MISSING' ||
          data.code === 'GOOGLE_AUTH_EXPIRED' ||
          data.code === 'NO_REFRESH_TOKEN'
        ) {
          setAuthStatus(
            data.code === 'SHEETS_SCOPE_MISSING'
              ? { status: 'missing_scope' }
              : { status: 'token_expired', canRefresh: false },
          )
          toast.error(getFriendlyErrorMessage({ code: data.code, error: data.error }))
        } else {
          toast.error(getFriendlyErrorMessage({ code: data.code ?? 'UNKNOWN_ERROR', error: data.error ?? 'Sync failed' }))
        }
        return
      }

      setSheetUrl(data.sheetUrl)
      setLastSyncedAt(new Date(data.syncedAt))
      toast.success(force ? 'Google Sheets re-sync complete.' : 'Google Sheets sync complete.')
      onSyncSuccess?.()
    } catch {
      toast.error('Network error. Sync failed, please try again.')
    } finally {
      setUploading(false)
    }
  }, [categories, onSyncSuccess, receiptId])

  const authBanner = (() => {
    if (!authStatus || authStatus.status === 'ok') return null
    if (authStatus.status === 'not_connected') return {
      title: 'Google account not connected',
      body: 'Connect Google before you sync receipts into Sheets.',
      action: 'Connect Google',
    }
    if (authStatus.status === 'missing_scope') return {
      title: 'Sheets permission missing',
      body: 'Reconnect Google and allow Google Sheets access to enable syncing.',
      action: 'Reconnect Google',
    }
    return {
      title: 'Google session expired',
      body: 'Sign in with Google again so the app can refresh your Sheets access.',
      action: 'Sign in again',
    }
  })()

  const syncBanner = (() => {
    if (syncStatus === 'synced') {
      return {
        tone: 'green',
        icon: CheckCircle2,
        title: 'Synced to Google Sheets',
        body: lastSyncedAt
          ? `Last synced ${formatDistanceToNow(lastSyncedAt, { addSuffix: true })}.`
          : 'This receipt is already in your spreadsheet.',
      }
    }
    if (syncStatus === 'syncing') {
      return {
        tone: 'sky',
        icon: Clock3,
        title: 'Sync in progress',
        body: 'The latest receipt data is being pushed to Google Sheets.',
      }
    }
    if (syncStatus === 'failed') {
      return {
        tone: 'red',
        icon: AlertTriangle,
        title: 'Last sync failed',
        body: syncErrorMessage ?? 'Google Sheets sync failed. You can retry safely.',
      }
    }
    if (syncStatus === 'stale') {
      return {
        tone: 'amber',
        icon: RotateCcw,
        title: 'Spreadsheet is stale',
        body: 'This receipt changed after the last sync. Re-sync to update Google Sheets.',
      }
    }
    return null
  })()

  const uploadBlocked = authBanner !== null || authStatus === null || reviewStatus !== 'approved'
  const shouldForceSync = syncStatus === 'stale' || syncStatus === 'failed' || alreadyUploaded

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-3xl max-h-[90vh] flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
              <Sheet className="h-4 w-4 text-green-600" />
            </div>
            <DialogTitle>Sync to Google Sheets</DialogTitle>
          </div>
          <DialogDescription>
            Push {storeName ?? 'this receipt'} into your grocery tracker spreadsheet with the reviewed categories below.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {reviewStatus !== 'approved' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">Approve this receipt before syncing</p>
                <p className="text-xs text-amber-700 mt-1">
                  Review the extracted fields first so the spreadsheet stays clean and trustworthy.
                </p>
              </div>
            </div>
          )}

          {authStatus === null && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking Google connection...
            </div>
          )}

          {authBanner && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-amber-800">{authBanner.title}</p>
                <p className="text-xs text-amber-700">{authBanner.body}</p>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/api/auth/signin?callbackUrl=/dashboard">{authBanner.action}</Link>
                </Button>
              </div>
            </div>
          )}

          {syncBanner && (
            <div className={`rounded-xl border p-4 flex items-start gap-3 ${
              syncBanner.tone === 'green'
                ? 'border-green-200 bg-green-50'
                : syncBanner.tone === 'amber'
                  ? 'border-amber-200 bg-amber-50'
                  : syncBanner.tone === 'red'
                    ? 'border-red-200 bg-red-50'
                    : 'border-sky-200 bg-sky-50'
            }`}>
              <syncBanner.icon className={`h-4 w-4 mt-0.5 shrink-0 ${
                syncBanner.tone === 'green'
                  ? 'text-green-600'
                  : syncBanner.tone === 'amber'
                    ? 'text-amber-600'
                    : syncBanner.tone === 'red'
                      ? 'text-red-600'
                      : 'text-sky-600'
              }`} />
              <div className="space-y-1 flex-1">
                <p className="text-sm font-medium">{syncBanner.title}</p>
                <p className="text-xs text-muted-foreground">{syncBanner.body}</p>
                {sheetUrl && (
                  <a
                    href={sheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs underline hover:text-foreground"
                  >
                    Open spreadsheet <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Review categories before sync
            </p>
            <div className="rounded-xl border overflow-hidden">
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Item</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground w-40">Category</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={item.id} className={index % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                        <td className="px-3 py-2 truncate max-w-[220px]" title={item.item}>
                          {item.item}
                        </td>
                        <td className="px-3 py-1">
                          <Select
                            value={categories[item.id] ?? 'Other'}
                            onValueChange={(value) => setCategories((prev) => ({ ...prev, [item.id]: value }))}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ITEM_CATEGORIES.map((category) => (
                                <SelectItem key={category} value={category} className="text-xs">
                                  {category}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {item.lineTotal != null ? `$${item.lineTotal.toFixed(2)}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {grandTotal != null && (
                    <tfoot className="border-t bg-muted/30">
                      <tr>
                        <td colSpan={2} className="px-3 py-2 font-medium text-sm">Grand Total</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-primary">
                          ${grandTotal.toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2 border-t flex-col sm:flex-row">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading} className="w-full sm:w-auto">
            Close
          </Button>
          <Button
            onClick={() => handleUpload(shouldForceSync)}
            disabled={uploading || uploadBlocked}
            className="gap-2 w-full sm:w-auto"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sheet className="h-4 w-4" />}
            {uploading
              ? 'Syncing...'
              : syncStatus === 'stale'
                ? 'Re-sync to Sheets'
                : syncStatus === 'failed'
                  ? 'Retry Sync'
                  : syncStatus === 'synced'
                    ? 'Sync Again'
                    : 'Sync to Sheets'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function GoogleSheetsButton({
  receiptId,
  storeName,
  items,
  grandTotal,
  alreadyUploaded,
  existingSheetUrl,
  sheetsSyncedAt,
  syncStatus,
  syncErrorMessage,
  reviewStatus,
  onSyncSuccess,
}: Omit<Props, 'open' | 'onOpenChange'>) {
  const [open, setOpen] = useState(false)

  const handleClick = () => {
    const pref = (localStorage.getItem(PREF_KEY) as Pref | null) ?? 'ask'
    if (pref === 'never' && !alreadyUploaded) {
      toast('Sheets sync skipped by preference. Open the modal again any time.', { icon: '📋' })
      return
    }
    setOpen(true)
  }

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={handleClick}>
        <Sheet className="h-4 w-4 text-green-600" />
        {syncStatus === 'failed'
          ? 'Retry Sheets'
          : syncStatus === 'stale'
            ? 'Re-sync Sheets'
            : alreadyUploaded
              ? 'Sheets'
              : 'Sync to Sheets'}
      </Button>
      <GoogleSheetsModal
        receiptId={receiptId}
        storeName={storeName}
        items={items}
        grandTotal={grandTotal}
        alreadyUploaded={alreadyUploaded}
        existingSheetUrl={existingSheetUrl}
        sheetsSyncedAt={sheetsSyncedAt}
        syncStatus={syncStatus}
        syncErrorMessage={syncErrorMessage}
        reviewStatus={reviewStatus}
        open={open}
        onOpenChange={setOpen}
        onSyncSuccess={onSyncSuccess}
      />
    </>
  )
}
