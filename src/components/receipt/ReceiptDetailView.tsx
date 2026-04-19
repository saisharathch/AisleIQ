'use client'

import { useState, useCallback, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Download, Plus, AlertTriangle, FileText, CheckCircle, Loader2, XCircle,
  RefreshCw, Copy, Check, ShieldAlert, Sparkles, Save, CalendarDays, Store,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ReceiptTable } from './ReceiptTable'
import { ExportMenu } from './ExportMenu'
import { GoogleSheetsButton } from './GoogleSheetsModal'
import { calcTotals, formatCurrency, validateItems } from '@/lib/calculations'
import { getFriendlyErrorMessage, readApiError } from '@/lib/api-client'
import type { Receipt, ReceiptItem } from '@prisma/client'
import type { ReviewStatus, SyncStatus } from '@/types'

interface Props {
  receipt: Receipt & {
    items: ReceiptItem[]
    editLogs: Array<{
      id: string
      field: string
      oldValue: string | null
      newValue: string | null
      createdAt: Date
      action: string
      user: { name: string | null; email: string }
    }>
  }
}

const statusConfig = {
  done: { label: 'Processed', icon: CheckCircle, variant: 'success' as const },
  processing: { label: 'Processing...', icon: Loader2, variant: 'secondary' as const },
  queued: { label: 'Queued', icon: Loader2, variant: 'outline' as const },
  pending: { label: 'Queued', icon: Loader2, variant: 'outline' as const },
  failed: { label: 'Failed', icon: XCircle, variant: 'destructive' as const },
}

const syncBadgeMap: Record<SyncStatus, { label: string; variant: 'success' | 'secondary' | 'outline' | 'destructive' }> = {
  not_synced: { label: 'Not Synced', variant: 'outline' },
  syncing: { label: 'Syncing', variant: 'secondary' },
  synced: { label: 'Synced', variant: 'success' },
  failed: { label: 'Sync Failed', variant: 'destructive' },
  stale: { label: 'Stale After Edit', variant: 'secondary' },
}

interface ReceiptMetaState {
  id: string
  storeName: string | null
  purchaseDate: string
  subtotal: number | null
  totalTax: number | null
  discount: number | null
  grandTotal: number | null
  notes: string
  paidBy: string
  splitWith: string[]
  reviewStatus: ReviewStatus
  syncStatus: SyncStatus
  syncErrorMessage: string | null
  sheetsUploadId: string | null
  sheetsSyncedAt: string | null
  duplicateOfReceiptId: string | null
  duplicateScore: number | null
  duplicateReason: string | null
  duplicateOverride: boolean
  overallConfidence: number | null
}

function toMetaState(receipt: Props['receipt']): ReceiptMetaState {
  return {
    id: receipt.id,
    storeName: receipt.storeName,
    purchaseDate: receipt.purchaseDate ? new Date(receipt.purchaseDate).toISOString().slice(0, 10) : '',
    subtotal: receipt.subtotal,
    totalTax: receipt.totalTax,
    discount: receipt.discount,
    grandTotal: receipt.grandTotal,
    notes: receipt.notes ?? '',
    paidBy: (receipt as { paidBy?: string | null }).paidBy ?? '',
    splitWith: (() => { try { return JSON.parse((receipt as { splitWith?: string | null }).splitWith ?? '[]') } catch { return [] } })(),
    reviewStatus: (receipt.reviewStatus as ReviewStatus | undefined) ?? 'needs_review',
    syncStatus: (receipt.syncStatus as SyncStatus | undefined) ?? 'not_synced',
    syncErrorMessage: receipt.syncErrorMessage ?? null,
    sheetsUploadId: receipt.sheetsUploadId ?? null,
    sheetsSyncedAt: receipt.sheetsSyncedAt ? new Date(receipt.sheetsSyncedAt).toISOString() : null,
    duplicateOfReceiptId: receipt.duplicateOfReceiptId ?? null,
    duplicateScore: receipt.duplicateScore ?? null,
    duplicateReason: receipt.duplicateReason ?? null,
    duplicateOverride: receipt.duplicateOverride ?? false,
    overallConfidence: receipt.overallConfidence ?? null,
  }
}

export function ReceiptDetailView({ receipt }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<ReceiptItem[]>(receipt.items)
  const [saving, setSaving] = useState<string | null>(null)
  const [receiptStatus, setReceiptStatus] = useState(receipt.status)
  const [copied, setCopied] = useState(false)
  const [meta, setMeta] = useState<ReceiptMetaState>(() => toMetaState(receipt))
  const [draft, setDraft] = useState(() => toMetaState(receipt))
  const [savingReview, setSavingReview] = useState(false)
  const totals = calcTotals(items)
  const issues = validateItems(items)
  const status = statusConfig[receiptStatus as keyof typeof statusConfig] ?? statusConfig.pending
  const StatusIcon = status.icon

  const reloadReceipt = useCallback(async () => {
    const res = await fetch(`/api/receipts/${receipt.id}`)
    if (!res.ok) return

    const payload = await res.json()
    const freshReceipt = payload.data as Props['receipt']
    setItems(freshReceipt.items)
    setMeta(toMetaState(freshReceipt))
    setDraft(toMetaState(freshReceipt))
    setReceiptStatus(freshReceipt.status)
  }, [receipt.id])

  useEffect(() => {
    if (receiptStatus !== 'queued' && receiptStatus !== 'processing' && receiptStatus !== 'pending') return

    let cancelled = false
    let attempts = 0

    const poll = async () => {
      if (cancelled || attempts > 60) return
      attempts++

      try {
        const res = await fetch(`/api/receipts/${receipt.id}/status`)
        if (!res.ok) return

        const { data } = await res.json()
        if (!cancelled) setReceiptStatus(data.status)

        if (data.status === 'done') {
          await reloadReceipt()
          router.refresh()
          toast.success('Receipt processed and ready for review.')
        } else if (data.status === 'failed') {
          toast.error(data.errorMessage ?? 'OCR failed')
        } else {
          setTimeout(poll, 2500)
        }
      } catch {
        if (!cancelled) setTimeout(poll, 2500)
      }
    }

    const timer = setTimeout(poll, 2500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [receipt.id, receiptStatus, reloadReceipt, router])

  const updateReceiptFields = useCallback(async (fields: Record<string, unknown>) => {
    const res = await fetch(`/api/receipts/${receipt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })

    if (!res.ok) {
      const error = await readApiError(res, 'Failed to save receipt changes')
      throw new Error(getFriendlyErrorMessage(error))
    }

    const payload = await res.json()
    const updated = payload.data as Receipt
    setMeta((prev) => ({
      ...prev,
      storeName: updated.storeName,
      purchaseDate: updated.purchaseDate ? new Date(updated.purchaseDate).toISOString().slice(0, 10) : '',
      subtotal: updated.subtotal,
      totalTax: updated.totalTax,
      discount: updated.discount,
      grandTotal: updated.grandTotal,
      notes: updated.notes ?? '',
      paidBy: (updated as { paidBy?: string | null }).paidBy ?? '',
      splitWith: (() => { try { return JSON.parse((updated as { splitWith?: string | null }).splitWith ?? '[]') } catch { return [] } })(),
      reviewStatus: (updated.reviewStatus as ReviewStatus | undefined) ?? prev.reviewStatus,
      syncStatus: (updated.syncStatus as SyncStatus | undefined) ?? prev.syncStatus,
      syncErrorMessage: updated.syncErrorMessage ?? prev.syncErrorMessage,
      sheetsUploadId: updated.sheetsUploadId ?? prev.sheetsUploadId,
      sheetsSyncedAt: updated.sheetsSyncedAt ? new Date(updated.sheetsSyncedAt).toISOString() : prev.sheetsSyncedAt,
      duplicateOfReceiptId: updated.duplicateOfReceiptId ?? prev.duplicateOfReceiptId,
      duplicateScore: updated.duplicateScore ?? prev.duplicateScore,
      duplicateReason: updated.duplicateReason ?? prev.duplicateReason,
      duplicateOverride: updated.duplicateOverride ?? prev.duplicateOverride,
      overallConfidence: updated.overallConfidence ?? prev.overallConfidence,
    }))
    return updated
  }, [receipt.id])

  const buildReviewPayload = useCallback((reviewStatus?: ReviewStatus) => ({
    storeName: draft.storeName,
    purchaseDate: draft.purchaseDate ? new Date(draft.purchaseDate).toISOString() : null,
    subtotal: draft.subtotal,
    totalTax: draft.totalTax,
    discount: draft.discount,
    grandTotal: draft.grandTotal,
    notes: draft.notes,
    paidBy: draft.paidBy || null,
    splitWith: draft.splitWith.length > 0 ? JSON.stringify(draft.splitWith) : null,
    ...(reviewStatus ? { reviewStatus } : {}),
  }), [draft])

  const saveReviewFields = useCallback(async () => {
    setSavingReview(true)
    try {
      await updateReceiptFields(buildReviewPayload())
      toast.success('Receipt review fields saved.')
      await reloadReceipt()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSavingReview(false)
    }
  }, [buildReviewPayload, reloadReceipt, updateReceiptFields])

  const approveReceipt = useCallback(async () => {
    setSavingReview(true)
    try {
      await updateReceiptFields(buildReviewPayload('approved'))
      toast.success('Receipt approved and ready to sync.')
      await reloadReceipt()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSavingReview(false)
    }
  }, [buildReviewPayload, reloadReceipt, updateReceiptFields])

  const overrideDuplicate = useCallback(async () => {
    setSavingReview(true)
    try {
      await updateReceiptFields({ duplicateOverride: true })
      toast.success('Duplicate warning overridden for this receipt.')
      await reloadReceipt()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSavingReview(false)
    }
  }, [reloadReceipt, updateReceiptFields])

  const updateItem = useCallback(
    async (itemId: string, field: string, value: unknown) => {
      setSaving(itemId)
      try {
        const res = await fetch(`/api/receipts/${receipt.id}/items/${itemId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: value }),
        })

        if (!res.ok) {
          const error = await readApiError(res, 'Failed to save item changes')
          throw new Error(getFriendlyErrorMessage(error))
        }

        const { data } = await res.json()
        setItems((prev) => prev.map((item) => (item.id === itemId ? data : item)))
        setMeta((prev) => ({ ...prev, syncStatus: prev.syncStatus === 'synced' ? 'stale' : prev.syncStatus }))
        toast.success('Item updated')
        await reloadReceipt()
      } catch (err) {
        toast.error((err as Error).message ?? 'Failed to save')
      } finally {
        setSaving(null)
      }
    },
    [receipt.id, reloadReceipt],
  )

  const addItem = useCallback(async () => {
    const res = await fetch(`/api/receipts/${receipt.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: 'New Item', quantity: 1, unitPrice: 0, lineTotal: 0 }),
    })

    if (!res.ok) {
      const error = await readApiError(res, 'Failed to add row')
      toast.error(getFriendlyErrorMessage(error))
      return
    }

    const { data } = await res.json()
    setItems((prev) => [...prev, data])
    setMeta((prev) => ({ ...prev, syncStatus: prev.syncStatus === 'synced' ? 'stale' : prev.syncStatus }))
    toast.success('Row added')
    await reloadReceipt()
  }, [receipt.id, reloadReceipt])

  const retryOcr = useCallback(async () => {
    setReceiptStatus('queued')

    try {
      const res = await fetch(`/api/receipts/${receipt.id}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retry' }),
      })
      if (!res.ok) {
        const error = await readApiError(res, 'Retry failed')
        setReceiptStatus('failed')
        throw new Error(getFriendlyErrorMessage(error))
      }

      toast.success('Queued for reprocessing...')
    } catch (err: unknown) {
      toast.error((err as Error).message)
    }
  }, [receipt.id])

  const deleteItem = useCallback(
    async (itemId: string) => {
      if (!confirm('Delete this row?')) return

      const res = await fetch(`/api/receipts/${receipt.id}/items/${itemId}`, { method: 'DELETE' })
      if (!res.ok) {
        const error = await readApiError(res, 'Failed to delete')
        toast.error(getFriendlyErrorMessage(error))
        return
      }

      setItems((prev) => prev.filter((item) => item.id !== itemId))
      setMeta((prev) => ({ ...prev, syncStatus: prev.syncStatus === 'synced' ? 'stale' : prev.syncStatus }))
      toast.success('Row deleted')
      await reloadReceipt()
    },
    [receipt.id, reloadReceipt],
  )

  const duplicateBlocked = !!meta.duplicateOfReceiptId && !meta.duplicateOverride
  const reviewApproved = meta.reviewStatus === 'approved'
  const syncBadge = syncBadgeMap[meta.syncStatus]

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
        <div className="flex items-start gap-3 flex-wrap w-full xl:w-auto">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl font-bold">{meta.storeName ?? 'Unknown Store'}</h1>
            <p className="text-sm text-muted-foreground">
              {meta.purchaseDate
                ? new Date(meta.purchaseDate).toLocaleDateString('en-US', {
                    weekday: 'short', year: 'numeric', month: 'long', day: 'numeric',
                  })
                : new Date(receipt.uploadDate).toLocaleDateString('en-US', {
                    weekday: 'short', year: 'numeric', month: 'long', day: 'numeric',
                  })}
            </p>
          </div>
          <Badge variant={status.variant} className="shrink-0">
            <StatusIcon className={`h-3 w-3 mr-1 ${receiptStatus === 'processing' ? 'animate-spin' : ''}`} />
            {status.label}
          </Badge>
          <Badge variant={reviewApproved ? 'success' : 'secondary'} className="shrink-0">
            {reviewApproved ? 'Approved' : 'Needs Review'}
          </Badge>
          <Badge variant={syncBadge.variant} className="shrink-0">{syncBadge.label}</Badge>
        </div>

        <div className="flex items-stretch sm:items-center gap-2 flex-wrap w-full xl:w-auto">
          <Button variant="outline" size="sm" className="gap-2 flex-1 sm:flex-none" onClick={addItem}>
            <Plus className="h-4 w-4" /> Add row
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 flex-1 sm:flex-none"
            title="Copy all rows as tab-separated values"
            onClick={async () => {
              const header = 'Store\tItem\tCategory\tQuantity\tUnit Price\tLine Total\tTax'
              const rows = items.map((item) =>
                [
                  meta.storeName ?? '',
                  item.item,
                  item.category ?? '',
                  item.quantity ?? '',
                  item.unitPrice?.toFixed(2) ?? '',
                  item.lineTotal?.toFixed(2) ?? '',
                  item.tax?.toFixed(2) ?? '',
                ].join('\t'),
              )
              await navigator.clipboard.writeText([header, ...rows].join('\n'))
              setCopied(true)
              toast.success('Copied to clipboard')
              setTimeout(() => setCopied(false), 2000)
            }}
          >
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
            Copy
          </Button>
          <ExportMenu receiptId={receipt.id} storeName={meta.storeName} />
          <GoogleSheetsButton
            receiptId={receipt.id}
            storeName={meta.storeName}
            items={items}
            grandTotal={meta.grandTotal}
            alreadyUploaded={!!meta.sheetsUploadId}
            existingSheetUrl={meta.sheetsUploadId ? `https://docs.google.com/spreadsheets/d/${meta.sheetsUploadId}` : null}
            sheetsSyncedAt={meta.sheetsSyncedAt ? new Date(meta.sheetsSyncedAt) : null}
            syncStatus={meta.syncStatus}
            syncErrorMessage={meta.syncErrorMessage}
            reviewStatus={meta.reviewStatus}
            onSyncSuccess={reloadReceipt}
          />
        </div>
      </div>

      {duplicateBlocked && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-700 mt-0.5 shrink-0" />
          <div className="space-y-2 min-w-0">
            <p className="font-medium text-amber-900">Likely duplicate receipt detected</p>
            <p className="text-sm text-amber-800">
              This looks similar to a prior receipt{meta.duplicateScore != null ? ` (${Math.round(meta.duplicateScore * 100)}% match)` : ''}.
              {meta.duplicateReason ? ` Signals: ${meta.duplicateReason}.` : ''}
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-2">
              {meta.duplicateOfReceiptId && (
                <Link href={`/receipts/${meta.duplicateOfReceiptId}`}>
                  <Button size="sm" variant="outline" className="w-full sm:w-auto">Open Possible Duplicate</Button>
                </Link>
              )}
              <Button size="sm" onClick={overrideDuplicate} disabled={savingReview} className="w-full sm:w-auto">
                This receipt is different, continue
              </Button>
            </div>
          </div>
        </div>
      )}

      {issues.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-1">
          <div className="flex items-center gap-2 text-amber-800 font-medium text-sm">
            <AlertTriangle className="h-4 w-4" />
            {issues.length} validation issue{issues.length > 1 ? 's' : ''} detected
          </div>
          {issues.slice(0, 4).map((issue, index) => (
            <p key={index} className="text-xs text-amber-700 ml-6">{issue.message}</p>
          ))}
        </div>
      )}

      {receiptStatus === 'failed' && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
          <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-destructive">OCR failed</p>
            <p className="text-xs text-muted-foreground mt-1">{receipt.errorMessage ?? 'Unknown error'}</p>
            <Button size="sm" variant="outline" className="mt-2 gap-2" onClick={retryOcr}>
              <RefreshCw className="h-3.5 w-3.5" /> Retry OCR
            </Button>
          </div>
        </div>
      )}

      {(receiptStatus === 'queued' || receiptStatus === 'processing') && (
        <div className="rounded-2xl border border-secondary bg-secondary/30 p-4 flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
          <p className="text-sm text-muted-foreground">
            {receiptStatus === 'queued'
              ? 'Waiting for the processing worker to pick this up...'
              : 'AI is reading your receipt. This usually takes 5-15 seconds.'}
          </p>
        </div>
      )}

      <div className="grid xl:grid-cols-5 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <div className="rounded-2xl border bg-card p-4 space-y-3 xl:sticky xl:top-20">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Original Receipt
            </div>
            {receipt.fileUrl ? (
              receipt.fileType === 'application/pdf' ? (
                <a
                  href={receipt.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border bg-muted p-4 text-sm hover:bg-muted/70 transition-colors"
                >
                  <FileText className="h-5 w-5 text-primary" />
                  <span className="truncate">{receipt.fileName}</span>
                  <Download className="h-4 w-4 ml-auto shrink-0" />
                </a>
              ) : (
                <div className="relative overflow-hidden rounded-xl border bg-muted aspect-[3/4]">
                  <Image
                    src={receipt.fileUrl}
                    alt="Receipt"
                    fill
                    className="object-contain"
                    sizes="(max-width: 1280px) 100vw, 34vw"
                  />
                </div>
              )
            ) : (
              <div className="flex items-center justify-center aspect-[3/4] rounded-xl border bg-muted text-muted-foreground text-sm">
                No preview
              </div>
            )}
          </div>
        </div>

        <div className="xl:col-span-3 space-y-4">
          <div className="rounded-2xl border bg-card p-4 sm:p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Human Review</p>
                <h2 className="text-lg font-semibold">Review extracted fields before final save and sync</h2>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={reviewApproved ? 'success' : 'secondary'}>
                  {reviewApproved ? 'Approved for sync' : 'Awaiting human review'}
                </Badge>
                {meta.overallConfidence != null && (
                  <Badge variant={meta.overallConfidence < 0.75 ? 'secondary' : 'outline'}>
                    <Sparkles className="h-3 w-3 mr-1" />
                    OCR {Math.round(meta.overallConfidence * 100)}%
                  </Badge>
                )}
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground flex items-center gap-2"><Store className="h-4 w-4" /> Store</span>
                <input
                  value={draft.storeName ?? ''}
                  onChange={(e) => setDraft((prev) => ({ ...prev, storeName: e.target.value || null }))}
                  className="w-full rounded-lg border bg-background px-3 py-2"
                  placeholder="Store name"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Purchase date</span>
                <input
                  type="date"
                  value={draft.purchaseDate}
                  onChange={(e) => setDraft((prev) => ({ ...prev, purchaseDate: e.target.value }))}
                  className="w-full rounded-lg border bg-background px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <input
                  type="number"
                  step="0.01"
                  value={draft.subtotal ?? ''}
                  onChange={(e) => setDraft((prev) => ({ ...prev, subtotal: e.target.value === '' ? null : parseFloat(e.target.value) }))}
                  className="w-full rounded-lg border bg-background px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Tax</span>
                <input
                  type="number"
                  step="0.01"
                  value={draft.totalTax ?? ''}
                  onChange={(e) => setDraft((prev) => ({ ...prev, totalTax: e.target.value === '' ? null : parseFloat(e.target.value) }))}
                  className="w-full rounded-lg border bg-background px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Discount</span>
                <input
                  type="number"
                  step="0.01"
                  value={draft.discount ?? ''}
                  onChange={(e) => setDraft((prev) => ({ ...prev, discount: e.target.value === '' ? null : parseFloat(e.target.value) }))}
                  className="w-full rounded-lg border bg-background px-3 py-2"
                />
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Grand total</span>
                <input
                  type="number"
                  step="0.01"
                  value={draft.grandTotal ?? ''}
                  onChange={(e) => setDraft((prev) => ({ ...prev, grandTotal: e.target.value === '' ? null : parseFloat(e.target.value) }))}
                  className="w-full rounded-lg border bg-background px-3 py-2"
                />
              </label>
            </div>

            <label className="space-y-1 text-sm block">
              <span className="text-muted-foreground">Notes</span>
              <textarea
                value={draft.notes}
                onChange={(e) => setDraft((prev) => ({ ...prev, notes: e.target.value }))}
                className="w-full rounded-lg border bg-background px-3 py-2 min-h-20"
                placeholder="Optional notes or follow-up reminders"
              />
            </label>

            {/* Roommate split */}
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Roommate Split</p>
              <label className="space-y-1 text-sm block">
                <span className="text-muted-foreground text-xs">Paid by</span>
                <input
                  value={draft.paidBy}
                  onChange={(e) => setDraft((prev) => ({ ...prev, paidBy: e.target.value }))}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                  placeholder="Who paid? (e.g. Alex)"
                />
              </label>
              <div className="space-y-1">
                <span className="text-muted-foreground text-xs">Split with (one per line)</span>
                <textarea
                  value={draft.splitWith.join('\n')}
                  onChange={(e) => setDraft((prev) => ({
                    ...prev,
                    splitWith: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
                  }))}
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm min-h-16"
                  placeholder="e.g.&#10;Alex&#10;Jordan"
                />
                {draft.splitWith.length > 0 && draft.grandTotal != null && (
                  <p className="text-xs text-slate-400">
                    ~${((draft.grandTotal ?? 0) / (draft.splitWith.length + 1)).toFixed(2)} per person
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-xl bg-muted/40 p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm w-full lg:w-auto">
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Items</p>
                  <p className="font-semibold">{totals.itemCount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Needs review</p>
                  <p className="font-semibold text-amber-700">{totals.flaggedCount}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Avg confidence</p>
                  <p className="font-semibold">{Math.round(totals.avgConfidence * 100)}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">Current total</p>
                  <p className="font-semibold text-primary">{formatCurrency(totals.grandTotal)}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                <Button type="button" variant="outline" className="gap-2 w-full sm:w-auto" onClick={saveReviewFields} disabled={savingReview}>
                  {savingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save Review
                </Button>
                <Button
                  type="button"
                  onClick={approveReceipt}
                  disabled={savingReview || duplicateBlocked || receiptStatus !== 'done'}
                  className="gap-2 w-full sm:w-auto"
                >
                  {savingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Approve Receipt
                </Button>
              </div>
            </div>
          </div>

          <ReceiptTable
            items={items}
            storeName={meta.storeName}
            savingId={saving}
            onUpdate={updateItem}
            onDelete={deleteItem}
          />

          <div className="rounded-2xl border bg-card p-4">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal ({totals.itemCount} items)</span>
                <span>{formatCurrency(meta.subtotal ?? totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Total Tax</span>
                <span>{formatCurrency(meta.totalTax ?? totals.totalTax)}</span>
              </div>
              {meta.discount ? (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{formatCurrency(meta.discount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
                <span>Grand Total</span>
                <span className="text-primary">{formatCurrency(meta.grandTotal ?? totals.grandTotal)}</span>
              </div>
            </div>
            {meta.syncStatus === 'failed' && meta.syncErrorMessage && (
              <p className="text-xs text-destructive mt-3">
                Last sync error: {meta.syncErrorMessage}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
