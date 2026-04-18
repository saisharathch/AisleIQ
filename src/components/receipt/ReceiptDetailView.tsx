'use client'

import { useState, useCallback, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Download, Plus, AlertTriangle, FileText,
  CheckCircle, Loader2, XCircle, RefreshCw, Copy, Check
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ReceiptTable } from './ReceiptTable'
import { ExportMenu } from './ExportMenu'
import { GoogleSheetsButton } from './GoogleSheetsModal'
import { calcTotals, formatCurrency, validateItems } from '@/lib/calculations'
import type { Receipt, ReceiptItem } from '@prisma/client'

interface Props {
  receipt: Receipt & {
    items: ReceiptItem[]
    editLogs: Array<{ id: string; field: string; oldValue: string | null; newValue: string | null; createdAt: Date; action: string; user: { name: string | null; email: string } }>
  }
}

const statusConfig = {
  done: { label: 'Processed', icon: CheckCircle, variant: 'success' as const },
  processing: { label: 'Processing…', icon: Loader2, variant: 'secondary' as const },
  pending: { label: 'Pending', icon: Loader2, variant: 'outline' as const },
  failed: { label: 'Failed', icon: XCircle, variant: 'destructive' as const },
}

export function ReceiptDetailView({ receipt }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<ReceiptItem[]>(receipt.items)
  const [saving, setSaving] = useState<string | null>(null)

  const [receiptStatus, setReceiptStatus] = useState(receipt.status)
  const [copied, setCopied] = useState(false)
  const totals = calcTotals(items)
  const issues = validateItems(items)
  const status = statusConfig[receiptStatus as keyof typeof statusConfig] ?? statusConfig.pending
  const StatusIcon = status.icon

  // Auto-poll when the receipt is still being processed
  useEffect(() => {
    if (receiptStatus !== 'processing' && receiptStatus !== 'pending') return
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
          router.refresh()
          toast.success('Receipt processed!')
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
  }, [receipt.id, receiptStatus, router])

  const updateItem = useCallback(
    async (itemId: string, field: string, value: unknown) => {
      setSaving(itemId)
      try {
        const res = await fetch(`/api/receipts/${receipt.id}/items/${itemId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: value }),
        })
        if (!res.ok) throw new Error('Save failed')
        const { data } = await res.json()
        setItems((prev) => prev.map((it) => (it.id === itemId ? data : it)))
        toast.success('Saved')
      } catch {
        toast.error('Failed to save')
      } finally {
        setSaving(null)
      }
    },
    [receipt.id],
  )

  const addItem = useCallback(async () => {
    const res = await fetch(`/api/receipts/${receipt.id}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item: 'New Item', quantity: 1, unitPrice: 0, lineTotal: 0 }),
    })
    if (!res.ok) { toast.error('Failed to add row'); return }
    const { data } = await res.json()
    setItems((prev) => [...prev, data])
    toast.success('Row added')
  }, [receipt.id])

  const retryOcr = useCallback(async () => {
    setReceiptStatus('processing')
    try {
      const res = await fetch(`/api/receipts/${receipt.id}/retry`, { method: 'POST' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Retry failed')
      }
      toast.success('Re-processing started…')
      // Poll for completion
      let attempts = 0
      const poll = async (): Promise<void> => {
        if (attempts++ > 60) { toast.error('Timed out waiting for result'); return }
        await new Promise((r) => setTimeout(r, 2000))
        const st = await fetch(`/api/receipts/${receipt.id}/status`)
        const { data } = await st.json()
        if (data.status === 'done') {
          setReceiptStatus('done')
          router.refresh()
          toast.success('Receipt re-processed!')
        } else if (data.status === 'failed') {
          setReceiptStatus('failed')
          toast.error(data.errorMessage ?? 'OCR failed')
        } else {
          return poll()
        }
      }
      await poll()
    } catch (err: unknown) {
      toast.error((err as Error).message)
      setReceiptStatus('failed')
    }
  }, [receipt.id, router])

  const deleteItem = useCallback(
    async (itemId: string) => {
      if (!confirm('Delete this row?')) return
      const res = await fetch(`/api/receipts/${receipt.id}/items/${itemId}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Failed to delete'); return }
      setItems((prev) => prev.filter((it) => it.id !== itemId))
      toast.success('Row deleted')
    },
    [receipt.id],
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">{receipt.storeName ?? 'Unknown Store'}</h1>
            <p className="text-sm text-muted-foreground">
              {new Date(receipt.uploadDate).toLocaleDateString('en-US', {
                weekday: 'short', year: 'numeric', month: 'long', day: 'numeric',
              })}
            </p>
          </div>
          <Badge variant={status.variant}>
            <StatusIcon className={`h-3 w-3 mr-1 ${receiptStatus === 'processing' ? 'animate-spin' : ''}`} />
            {status.label}
          </Badge>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" className="gap-2" onClick={addItem}>
            <Plus className="h-4 w-4" /> Add row
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            title="Copy all rows as tab-separated values"
            onClick={async () => {
              const header = 'Store\tItem\tQuantity\tUnit Price\tLine Total\tTax'
              const rows = items.map((it) =>
                [
                  receipt.storeName ?? '',
                  it.item,
                  it.quantity ?? '',
                  it.unitPrice?.toFixed(2) ?? '',
                  it.lineTotal?.toFixed(2) ?? '',
                  it.tax?.toFixed(2) ?? '',
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
          <ExportMenu receiptId={receipt.id} storeName={receipt.storeName} />
          <GoogleSheetsButton
            receiptId={receipt.id}
            storeName={receipt.storeName}
            items={items}
            grandTotal={receipt.grandTotal}
            alreadyUploaded={!!receipt.sheetsUploadId}
            existingSheetUrl={
              receipt.sheetsUploadId
                ? `https://docs.google.com/spreadsheets/d/${receipt.sheetsUploadId}`
                : null
            }
          />
        </div>
      </div>

      {/* Validation warnings */}
      {issues.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-1">
          <div className="flex items-center gap-2 text-amber-800 font-medium text-sm">
            <AlertTriangle className="h-4 w-4" />
            {issues.length} validation issue{issues.length > 1 ? 's' : ''} detected
          </div>
          {issues.slice(0, 3).map((issue, i) => (
            <p key={i} className="text-xs text-amber-700 ml-6">{issue.message}</p>
          ))}
        </div>
      )}

      {/* Failed state */}
      {receiptStatus === 'failed' && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
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

      {/* Processing state */}
      {receiptStatus === 'processing' && (
        <div className="rounded-lg border border-secondary bg-secondary/30 p-4 flex items-center gap-3">
          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
          <p className="text-sm text-muted-foreground">AI is reading your receipt… this usually takes 5–15 seconds.</p>
        </div>
      )}

      {/* Main content */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Receipt image preview */}
        <div className="lg:col-span-2">
          <div className="rounded-lg border bg-card p-4 space-y-3 sticky top-20">
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
                <div className="relative overflow-hidden rounded-lg border bg-muted aspect-[3/4]">
                  <Image
                    src={receipt.fileUrl}
                    alt="Receipt"
                    fill
                    className="object-contain"
                    sizes="(max-width: 1024px) 100vw, 40vw"
                  />
                </div>
              )
            ) : (
              <div className="flex items-center justify-center aspect-[3/4] rounded-lg border bg-muted text-muted-foreground text-sm">
                No preview
              </div>
            )}
          </div>
        </div>

        {/* Editable table */}
        <div className="lg:col-span-3 space-y-4">
          <ReceiptTable
            items={items}
            storeName={receipt.storeName}
            savingId={saving}
            onUpdate={updateItem}
            onDelete={deleteItem}
          />

          {/* Totals */}
          <div className="rounded-lg border bg-card p-4">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal ({totals.itemCount} items)</span>
                <span>{formatCurrency(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Total Tax</span>
                <span>{formatCurrency(totals.totalTax)}</span>
              </div>
              {receipt.discount ? (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>−{formatCurrency(receipt.discount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between font-bold text-base border-t pt-2 mt-2">
                <span>Grand Total</span>
                <span className="text-primary">{formatCurrency(totals.grandTotal)}</span>
              </div>
            </div>
            {totals.flaggedCount > 0 && (
              <p className="text-xs text-amber-600 mt-2">
                ⚠ {totals.flaggedCount} item{totals.flaggedCount > 1 ? 's' : ''} flagged for review
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
