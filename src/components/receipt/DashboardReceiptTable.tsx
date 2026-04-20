'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import {
  ArrowUpRight, Trash2, CheckCircle2, AlertCircle, XCircle, Loader2, Clock, ReceiptText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { ReceiptCard } from './ReceiptCard'

interface Row {
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

function StatusPill({ status, reviewStatus }: { status: string; reviewStatus?: string | null }) {
  if (status === 'failed')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400 ring-1 ring-rose-100 dark:ring-rose-900/50">
        <XCircle className="h-3 w-3" />Failed
      </span>
    )
  if (status === 'processing')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 ring-1 ring-blue-100 dark:ring-blue-900/50">
        <Loader2 className="h-3 w-3 animate-spin" />Processing
      </span>
    )
  if (status === 'queued' || status === 'pending')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 ring-1 ring-slate-200 dark:ring-slate-700">
        <Clock className="h-3 w-3" />Queued
      </span>
    )
  if (reviewStatus === 'approved')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-100 dark:ring-emerald-900/50">
        <CheckCircle2 className="h-3 w-3" />Approved
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 ring-1 ring-amber-100 dark:ring-amber-900/50">
      <AlertCircle className="h-3 w-3" />Needs Review
    </span>
  )
}

function DeleteDialog({
  open, onOpenChange, storeName, onConfirm, deleting,
}: {
  open: boolean; onOpenChange: (v: boolean) => void
  storeName: string | null; onConfirm: () => void; deleting: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm glass border-0 shadow-2xl">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-50 to-rose-100 dark:from-rose-950/40 dark:to-rose-900/20 ring-1 ring-rose-100 dark:ring-rose-800/30">
            <Trash2 className="h-5 w-5 text-rose-500" />
          </div>
          <DialogTitle className="text-center">Delete receipt?</DialogTitle>
          <DialogDescription className="text-center">
            <span className="font-medium text-slate-700 dark:text-slate-300">{storeName ?? 'This receipt'}</span> will be permanently deleted. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={deleting}>Cancel</Button>
          <Button variant="destructive" className="flex-1 gap-2" onClick={onConfirm} disabled={deleting}>
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TableRow({ row }: { row: Row }) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const date = row.purchaseDate
    ? new Date(row.purchaseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : formatDistanceToNow(new Date(row.uploadDate), { addSuffix: true })

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/receipts/${row.id}`, { method: 'DELETE' })
    setDeleting(false)
    setConfirmOpen(false)
    if (res.ok) { toast.success('Receipt deleted'); router.refresh() }
    else toast.error('Failed to delete receipt')
  }

  return (
    <>
      <tr className="group relative border-b border-slate-100 dark:border-slate-800/60 hover:bg-teal-50/30 dark:hover:bg-teal-950/10 transition-colors duration-150">
        {/* Left accent on hover */}
        <td className="relative py-3 pl-4 pr-3">
          <span className="absolute left-0 inset-y-2 w-0.5 rounded-full bg-teal-500 scale-y-0 group-hover:scale-y-100 transition-transform origin-center duration-200" />
          <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate max-w-[180px]">
            {row.storeName ?? 'Unknown Store'}
          </div>
          {row.duplicateOfReceiptId && (
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Possible duplicate</span>
          )}
        </td>
        <td className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">{date}</td>
        <td className="px-3 py-3 text-sm text-slate-500 dark:text-slate-400 text-center font-medium">
          {row.status === 'done' ? (row._count?.items ?? 0) : <span className="text-slate-300 dark:text-slate-600">—</span>}
        </td>
        <td className="px-3 py-3 text-sm font-bold text-slate-900 dark:text-slate-100 text-right whitespace-nowrap">
          {row.status === 'done' && row.grandTotal != null
            ? <span className="text-teal-700 dark:text-teal-400">${row.grandTotal.toFixed(2)}</span>
            : <span className="text-slate-300 dark:text-slate-600">—</span>}
        </td>
        <td className="px-3 py-3">
          <StatusPill status={row.status} reviewStatus={row.reviewStatus} />
        </td>
        <td className="px-3 py-3">
          {row.syncStatus === 'synced' && (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
              <CheckCircle2 className="h-3 w-3" />Sheets
            </span>
          )}
        </td>
        <td className="py-3 pl-3 pr-4">
          <div className="flex items-center gap-1 justify-end">
            <Link
              href={`/receipts/${row.id}`}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-950/50 transition-all hover:-translate-y-0.5"
            >
              View <ArrowUpRight className="h-3 w-3" />
            </Link>
            <button
              onClick={() => setConfirmOpen(true)}
              className="rounded-lg p-1.5 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all"
              aria-label="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </td>
      </tr>
      <DeleteDialog
        open={confirmOpen} onOpenChange={setConfirmOpen}
        storeName={row.storeName} onConfirm={handleDelete} deleting={deleting}
      />
    </>
  )
}

interface Props {
  rows: Row[]
  totalPages: number
  page: number
  total: number
  activeTab: string
  hasFilters: boolean
  search: string
  from: string
  to: string
  statusFilter: string
  reviewFilter: string
}

const TABS = [
  { label: 'All', status: '', review: '' },
  { label: 'Needs Review', status: 'done', review: 'needs_review' },
  { label: 'Approved', status: 'done', review: 'approved' },
  { label: 'Failed', status: 'failed', review: '' },
] as const

export function DashboardReceiptTable({
  rows, totalPages, page, total, activeTab, search, from, to, statusFilter, reviewFilter,
}: Props) {
  function buildFilterUrl(status: string, review: string) {
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (from)   p.set('from', from)
    if (to)     p.set('to', to)
    if (status) p.set('status', status)
    if (review) p.set('review', review)
    return `/dashboard?${p.toString()}`
  }

  function buildPageUrl(newPage: number) {
    const p = new URLSearchParams()
    if (search)       p.set('search', search)
    if (from)         p.set('from', from)
    if (to)           p.set('to', to)
    if (statusFilter) p.set('status', statusFilter)
    if (reviewFilter) p.set('review', reviewFilter)
    p.set('page', String(newPage))
    return `/dashboard?${p.toString()}`
  }

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Recent Receipts</h2>
          <p className="text-xs text-slate-400 mt-0.5">{total} total</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-slate-800/60 p-1">
          {TABS.map((tab) => {
            const isActive = tab.label === activeTab
            return (
              <Link key={tab.label} href={buildFilterUrl(tab.status, tab.review)}>
                <span className={`block px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  isActive
                    ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}>
                  {tab.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 py-20 text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 shadow-sm">
            <ReceiptText className="h-8 w-8 text-slate-300 dark:text-slate-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No receipts found</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Try adjusting the filters or upload a new receipt</p>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 overflow-hidden shadow-sm">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/30">
                  <th className="py-3 pl-4 pr-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">Store</th>
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">Date</th>
                  <th className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">Items</th>
                  <th className="px-3 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-slate-400">Total</th>
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">Status</th>
                  <th className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">Sync</th>
                  <th className="py-3 pl-3 pr-4" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => <TableRow key={row.id} row={row} />)}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="grid sm:hidden grid-cols-1 gap-3">
            {rows.map((row) => <ReceiptCard key={row.id} receipt={row} />)}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-1">
              {page > 1 && (
                <Link href={buildPageUrl(page - 1)}>
                  <Button variant="outline" size="sm" className="rounded-xl hover:-translate-y-0.5 transition-transform">Previous</Button>
                </Link>
              )}
              <span className="text-xs text-slate-500 font-medium px-3">Page {page} of {totalPages}</span>
              {page < totalPages && (
                <Link href={buildPageUrl(page + 1)}>
                  <Button variant="outline" size="sm" className="rounded-xl hover:-translate-y-0.5 transition-transform">Next</Button>
                </Link>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
