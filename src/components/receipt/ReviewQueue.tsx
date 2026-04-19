'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import {
  ArrowUpRight, CheckCircle2, AlertCircle, Loader2, ClipboardCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ReviewItem {
  id: string
  item: string
  confidence: number
  category: string | null
  lineTotal: number | null
}

interface ReviewReceipt {
  id: string
  storeName: string | null
  grandTotal: number | null
  purchaseDate: Date | null
  uploadDate: Date
  overallConfidence: number | null
  _count: { items: number }
  items: ReviewItem[]
}

function ConfidenceBadge({ value }: { value: number | null }) {
  if (value == null) return null
  const pct = Math.round(value * 100)
  const cls = pct >= 80 ? 'bg-emerald-50 text-emerald-700'
    : pct >= 60 ? 'bg-amber-50 text-amber-700'
    : 'bg-rose-50 text-rose-600'
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{pct}% confidence</span>
}

function ReviewCard({ receipt, onApproved }: { receipt: ReviewReceipt; onApproved: (id: string) => void }) {
  const [approving, setApproving] = useState(false)
  const date = receipt.purchaseDate
    ? new Date(receipt.purchaseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : formatDistanceToNow(new Date(receipt.uploadDate), { addSuffix: true })

  async function handleApprove() {
    setApproving(true)
    const res = await fetch(`/api/receipts/${receipt.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewStatus: 'approved' }),
    })
    setApproving(false)
    if (res.ok) {
      toast.success('Approved!')
      onApproved(receipt.id)
    } else {
      toast.error('Failed to approve')
    }
  }

  const conf = receipt.overallConfidence
  const isLow = conf != null && conf < 0.7

  return (
    <div className={`rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${
      isLow ? 'border-amber-100' : 'border-slate-100'
    }`}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900 truncate">{receipt.storeName ?? 'Unknown Store'}</h3>
            <ConfidenceBadge value={receipt.overallConfidence} />
            {isLow && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                <AlertCircle className="h-3 w-3" />Low confidence
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {date} · {receipt._count.items} item{receipt._count.items !== 1 ? 's' : ''}
            {receipt.grandTotal != null && ` · $${receipt.grandTotal.toFixed(2)}`}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/receipts/${receipt.id}`}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Edit <ArrowUpRight className="h-3 w-3" />
          </Link>
          <Button
            size="sm"
            onClick={handleApprove}
            disabled={approving}
            className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5 text-xs"
          >
            {approving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
            Approve
          </Button>
        </div>
      </div>

      {receipt.items.length > 0 && (
        <div className="rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 mb-2">Items needing review</p>
          <div className="space-y-1">
            {receipt.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span className="text-slate-700 truncate">{item.item}</span>
                  {item.category && <span className="text-slate-400 shrink-0">{item.category}</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {item.lineTotal != null && <span className="font-medium text-slate-700">${item.lineTotal.toFixed(2)}</span>}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    item.confidence >= 0.7 ? 'bg-emerald-50 text-emerald-600'
                    : item.confidence >= 0.5 ? 'bg-amber-50 text-amber-600'
                    : 'bg-rose-50 text-rose-600'
                  }`}>{Math.round(item.confidence * 100)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function ReviewQueue({ receipts }: { receipts: ReviewReceipt[] }) {
  const router = useRouter()
  const [list, setList] = useState(receipts)

  function onApproved(id: string) {
    setList((prev) => prev.filter((r) => r.id !== id))
    router.refresh()
  }

  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        </div>
        <div className="text-center">
          <h2 className="text-sm font-semibold text-slate-900">All caught up!</h2>
          <p className="text-xs text-slate-400 mt-1">No receipts need review right now.</p>
        </div>
        <Link href="/receipts">
          <Button variant="outline" size="sm">View all receipts</Button>
        </Link>
      </div>
    )
  }

  const lowConf = list.filter((r) => r.overallConfidence != null && r.overallConfidence < 0.7)
  const rest    = list.filter((r) => r.overallConfidence == null || r.overallConfidence >= 0.7)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-slate-900">Review Queue</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              <ClipboardCheck className="h-3 w-3" />{list.length}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Receipts waiting for your approval</p>
        </div>
      </div>

      {lowConf.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-amber-600">
            Low Confidence — Needs Careful Review ({lowConf.length})
          </h2>
          {lowConf.map((r) => <ReviewCard key={r.id} receipt={r} onApproved={onApproved} />)}
        </section>
      )}

      {rest.length > 0 && (
        <section className="space-y-3">
          {lowConf.length > 0 && (
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Other Receipts ({rest.length})
            </h2>
          )}
          {rest.map((r) => <ReviewCard key={r.id} receipt={r} onApproved={onApproved} />)}
        </section>
      )}
    </div>
  )
}
