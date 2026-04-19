'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Receipt as ReceiptIcon, XCircle, Loader2, Trash2, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ReceiptCardReceipt {
  id: string
  storeName: string | null
  status: string
  reviewStatus?: string | null
  syncStatus?: string | null
  duplicateOfReceiptId?: string | null
  grandTotal: number | null
  purchaseDate?: Date | null
  uploadDate: Date
  fileName: string
  _count?: { items: number }
}

function resolveStatus(receipt: ReceiptCardReceipt): {
  label: string
  color: string
  spinning?: boolean
  icon: React.ElementType
} {
  if (receipt.status === 'failed')
    return { label: 'Failed', color: 'text-rose-600 bg-rose-50', icon: XCircle }
  if (receipt.status === 'processing')
    return { label: 'Processing…', color: 'text-blue-600 bg-blue-50', spinning: true, icon: Loader2 }
  if (receipt.status === 'queued' || receipt.status === 'pending')
    return { label: 'Queued', color: 'text-slate-500 bg-slate-100', spinning: true, icon: Clock }
  if (receipt.reviewStatus === 'approved')
    return { label: 'Approved', color: 'text-emerald-700 bg-emerald-50', icon: CheckCircle2 }
  return { label: 'Needs Review', color: 'text-amber-700 bg-amber-50', icon: AlertCircle }
}

// ─── Delete confirmation dialog ────────────────────────────────────────────

function DeleteDialog({
  open,
  onOpenChange,
  storeName,
  onConfirm,
  deleting,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  storeName: string | null
  onConfirm: () => void
  deleting: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-rose-50">
            <Trash2 className="h-5 w-5 text-rose-500" />
          </div>
          <DialogTitle className="text-center">Delete receipt?</DialogTitle>
          <DialogDescription className="text-center">
            <span className="font-medium text-slate-700">{storeName ?? 'This receipt'}</span> will be
            permanently deleted along with all its items. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="flex-1 gap-2"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Card ──────────────────────────────────────────────────────────────────

export function ReceiptCard({ receipt }: { receipt: ReceiptCardReceipt }) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const status = resolveStatus(receipt)
  const StatusIcon = status.icon
  const itemCount = receipt._count?.items ?? 0
  const date = receipt.purchaseDate
    ? new Date(receipt.purchaseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : formatDistanceToNow(new Date(receipt.uploadDate), { addSuffix: true })

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/receipts/${receipt.id}`, { method: 'DELETE' })
    setDeleting(false)
    setConfirmOpen(false)
    if (res.ok) {
      toast.success('Receipt deleted')
      router.refresh()
    } else {
      toast.error('Failed to delete receipt')
    }
  }

  return (
    <>
      <Link href={`/receipts/${receipt.id}`} className="group block">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition-all space-y-3">

          {/* Row 1 — store + total */}
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 shrink-0 mt-0.5">
              <ReceiptIcon className="h-4 w-4 text-slate-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900 truncate leading-tight">
                {receipt.storeName ?? 'Unknown Store'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {date}
                {receipt.status === 'done' && itemCount > 0 && (
                  <> · {itemCount} item{itemCount !== 1 ? 's' : ''}</>
                )}
              </p>
            </div>
            {receipt.status === 'done' && receipt.grandTotal != null && (
              <p className="font-bold text-base text-slate-900 shrink-0 tabular-nums">
                ${receipt.grandTotal.toFixed(2)}
              </p>
            )}
          </div>

          {/* Row 2 — status + actions */}
          <div className="flex items-center justify-between gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${status.color}`}>
              <StatusIcon className={`h-3 w-3 ${status.spinning ? 'animate-spin' : ''}`} />
              {status.label}
            </span>

            <div className="flex items-center gap-1.5">
              {receipt.duplicateOfReceiptId && (
                <span className="text-[10px] text-amber-600 bg-amber-50 rounded-full px-2 py-0.5 font-medium">
                  Duplicate?
                </span>
              )}
              {receipt.syncStatus === 'synced' && (
                <span className="text-[10px] text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5 font-medium">
                  Sheets ✓
                </span>
              )}
              <button
                onClick={(e) => { e.preventDefault(); setConfirmOpen(true) }}
                className="h-6 w-6 flex items-center justify-center rounded-md text-slate-300 opacity-0 group-hover:opacity-100 hover:text-rose-500 hover:bg-rose-50 transition-all"
                aria-label="Delete receipt"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </Link>

      <DeleteDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        storeName={receipt.storeName}
        onConfirm={handleDelete}
        deleting={deleting}
      />
    </>
  )
}
