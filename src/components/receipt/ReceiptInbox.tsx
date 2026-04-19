'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import {
  ArrowUpRight, Trash2, CheckCircle2, AlertCircle, XCircle, Loader2, Clock,
  ChevronDown, Search, SlidersHorizontal, Check, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'

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

interface StatusCounts {
  all: number; needsReview: number; approved: number
  failed: number; processing: number; synced: number
}

interface Props {
  rows: Row[]
  total: number
  totalPages: number
  page: number
  statusCounts: StatusCounts
  search: string
  from: string
  to: string
  statusFilter: string
  reviewFilter: string
  sort: string
  minAmount: string
  maxAmount: string
}

const TABS = [
  { label: 'All',           status: '',       review: '',              count: (c: StatusCounts) => c.all },
  { label: 'Needs Review',  status: 'done',   review: 'needs_review',  count: (c: StatusCounts) => c.needsReview },
  { label: 'Approved',      status: 'done',   review: 'approved',      count: (c: StatusCounts) => c.approved },
  { label: 'Failed',        status: 'failed', review: '',              count: (c: StatusCounts) => c.failed },
] as const

const SORT_OPTIONS = [
  { value: 'newest',      label: 'Newest first' },
  { value: 'oldest',      label: 'Oldest first' },
  { value: 'amount-desc', label: 'Highest amount' },
  { value: 'amount-asc',  label: 'Lowest amount' },
  { value: 'store',       label: 'Store A → Z' },
]

function StatusPill({ status, reviewStatus }: { status: string; reviewStatus?: string | null }) {
  if (status === 'failed')
    return <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-600"><XCircle className="h-3 w-3" />Failed</span>
  if (status === 'processing')
    return <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-600"><Loader2 className="h-3 w-3 animate-spin" />Processing</span>
  if (status === 'queued' || status === 'pending')
    return <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500"><Clock className="h-3 w-3" />Queued</span>
  if (reviewStatus === 'approved')
    return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"><CheckCircle2 className="h-3 w-3" />Approved</span>
  return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700"><AlertCircle className="h-3 w-3" />Needs Review</span>
}

function BulkDeleteDialog({ open, onOpenChange, count, onConfirm, deleting }: {
  open: boolean; onOpenChange: (v: boolean) => void
  count: number; onConfirm: () => void; deleting: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-rose-50">
            <Trash2 className="h-5 w-5 text-rose-500" />
          </div>
          <DialogTitle className="text-center">Delete {count} receipt{count !== 1 ? 's' : ''}?</DialogTitle>
          <DialogDescription className="text-center">
            This will permanently delete the selected receipts. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={deleting}>Cancel</Button>
          <Button variant="destructive" className="flex-1 gap-2" onClick={onConfirm} disabled={deleting}>
            {deleting && <Loader2 className="h-4 w-4 animate-spin" />}Delete {count}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ReceiptInbox({
  rows, total, totalPages, page, statusCounts,
  search, from, to, statusFilter, reviewFilter, sort, minAmount, maxAmount,
}: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkApproving, setBulkApproving] = useState(false)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)
  const [showFilters, setShowFilters] = useState(!!(from || to || minAmount || maxAmount))
  const [searchVal, setSearchVal] = useState(search)
  const [fromVal, setFromVal] = useState(from)
  const [toVal, setToVal] = useState(to)
  const [minVal, setMinVal] = useState(minAmount)
  const [maxVal, setMaxVal] = useState(maxAmount)
  const [sortOpen, setSortOpen] = useState(false)

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id))
  const someSelected = selected.size > 0

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (allSelected) { setSelected(new Set()) }
    else { setSelected(new Set(rows.map((r) => r.id))) }
  }

  function buildUrl(overrides: Record<string, string>) {
    const p = new URLSearchParams()
    const base = { search, from, to, status: statusFilter, review: reviewFilter, sort, minAmount, maxAmount }
    Object.entries({ ...base, ...overrides }).forEach(([k, v]) => { if (v) p.set(k, v) })
    return `/receipts?${p.toString()}`
  }

  function buildTabUrl(status: string, review: string) {
    const p = new URLSearchParams()
    if (search) p.set('search', search)
    if (sort && sort !== 'newest') p.set('sort', sort)
    if (status) p.set('status', status)
    if (review) p.set('review', review)
    return `/receipts?${p.toString()}`
  }

  function buildPageUrl(newPage: number) {
    return buildUrl({ page: String(newPage) })
  }

  function applyFilters() {
    const p = new URLSearchParams()
    if (searchVal) p.set('search', searchVal)
    if (fromVal)   p.set('from', fromVal)
    if (toVal)     p.set('to', toVal)
    if (minVal)    p.set('minAmount', minVal)
    if (maxVal)    p.set('maxAmount', maxVal)
    if (statusFilter) p.set('status', statusFilter)
    if (reviewFilter) p.set('review', reviewFilter)
    if (sort && sort !== 'newest') p.set('sort', sort)
    router.push(`/receipts?${p.toString()}`)
  }

  function clearFilters() {
    setSearchVal(''); setFromVal(''); setToVal(''); setMinVal(''); setMaxVal('')
    router.push('/receipts')
  }

  async function handleBulkDelete() {
    setBulkDeleting(true)
    const ids = Array.from(selected)
    const results = await Promise.allSettled(
      ids.map((id) => fetch(`/api/receipts/${id}`, { method: 'DELETE' }))
    )
    const failed = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)).length
    setBulkDeleting(false)
    setConfirmBulkDelete(false)
    setSelected(new Set())
    if (failed > 0) toast.error(`${failed} deletion(s) failed`)
    else toast.success(`${ids.length} receipt${ids.length !== 1 ? 's' : ''} deleted`)
    router.refresh()
  }

  async function handleBulkApprove() {
    setBulkApproving(true)
    const ids = Array.from(selected).filter((id) => {
      const row = rows.find((r) => r.id === id)
      return row?.status === 'done' && row?.reviewStatus !== 'approved'
    })
    if (ids.length === 0) { toast('No eligible receipts to approve'); setBulkApproving(false); return }
    const results = await Promise.allSettled(
      ids.map((id) => fetch(`/api/receipts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewStatus: 'approved' }),
      }))
    )
    const failed = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)).length
    setBulkApproving(false)
    setSelected(new Set())
    if (failed > 0) toast.error(`${failed} approval(s) failed`)
    else toast.success(`${ids.length} receipt${ids.length !== 1 ? 's' : ''} approved`)
    router.refresh()
  }

  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label ?? 'Newest first'
  const hasFilters = !!(search || from || to || minAmount || maxAmount || statusFilter || reviewFilter)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-base font-semibold text-slate-900">Receipt Inbox</h1>
          <p className="text-xs text-slate-400 mt-0.5">{total} receipt{total !== 1 ? 's' : ''} total</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              showFilters || hasFilters
                ? 'border-teal-200 bg-teal-50 text-teal-700'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filters {hasFilters && '·'}
          </button>
          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => setSortOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              {currentSortLabel} <ChevronDown className="h-3 w-3" />
            </button>
            {sortOpen && (
              <div className="absolute right-0 top-full mt-1 z-10 w-44 rounded-xl border border-slate-200 bg-white shadow-lg py-1">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => { setSortOpen(false); router.push(buildUrl({ sort: opt.value, page: '1' })) }}
                    className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors ${
                      sort === opt.value ? 'text-teal-700 bg-teal-50' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
                  placeholder="Store name…"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">From date</label>
              <input
                type="date" value={fromVal} onChange={(e) => setFromVal(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">To date</label>
              <input
                type="date" value={toVal} onChange={(e) => setToVal(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Amount range</label>
              <div className="flex items-center gap-2">
                <input
                  type="number" value={minVal} onChange={(e) => setMinVal(e.target.value)}
                  placeholder="Min $" min="0"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                />
                <span className="text-slate-300 shrink-0">–</span>
                <input
                  type="number" value={maxVal} onChange={(e) => setMaxVal(e.target.value)}
                  placeholder="Max $" min="0"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                />
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 justify-end">
            <button onClick={clearFilters} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">Clear all</button>
            <Button size="sm" onClick={applyFilters} className="bg-teal-600 hover:bg-teal-700 text-white text-xs">Apply</Button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          {TABS.map((tab) => {
            const isActive = tab.status === statusFilter && tab.review === reviewFilter
            const count = tab.count(statusCounts)
            return (
              <Link key={tab.label} href={buildTabUrl(tab.status, tab.review)}>
                <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  isActive ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'
                }`}>
                  {tab.label}
                  {count > 0 && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
                      isActive ? 'bg-teal-100 text-teal-700' : 'bg-slate-200 text-slate-500'
                    }`}>
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5">
          <span className="text-xs font-semibold text-teal-800">{selected.size} selected</span>
          <div className="flex items-center gap-2 ml-auto">
            <Button
              size="sm" variant="outline"
              className="h-7 gap-1.5 text-xs border-teal-300 text-teal-700 hover:bg-teal-100"
              onClick={handleBulkApprove} disabled={bulkApproving || bulkDeleting}
            >
              {bulkApproving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Approve
            </Button>
            <Button
              size="sm" variant="outline"
              className="h-7 gap-1.5 text-xs border-rose-200 text-rose-600 hover:bg-rose-50"
              onClick={() => setConfirmBulkDelete(true)} disabled={bulkDeleting || bulkApproving}
            >
              <Trash2 className="h-3 w-3" />Delete
            </Button>
            <button onClick={() => setSelected(new Set())} className="text-teal-500 hover:text-teal-700 ml-1">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-20 text-center">
          <p className="text-sm font-medium text-slate-500">No receipts found</p>
          <p className="text-xs text-slate-400 mt-1">Try adjusting the filters or upload a new receipt</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80">
                <th className="py-2.5 pl-4 pr-2 w-8">
                  <button onClick={toggleAll} className="flex h-4 w-4 items-center justify-center rounded border border-slate-300 bg-white hover:border-teal-400 transition-colors">
                    {allSelected && <Check className="h-2.5 w-2.5 text-teal-600" />}
                  </button>
                </th>
                <th className="py-2.5 pl-2 pr-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">Store</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">Date</th>
                <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400">Items</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">Sync</th>
                <th className="py-2.5 pl-3 pr-4" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isSelected = selected.has(row.id)
                const date = row.purchaseDate
                  ? new Date(row.purchaseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : formatDistanceToNow(new Date(row.uploadDate), { addSuffix: true })
                return (
                  <tr
                    key={row.id}
                    className={`group border-b border-slate-100 transition-colors ${
                      isSelected ? 'bg-teal-50/40' : 'hover:bg-slate-50/60'
                    }`}
                  >
                    <td className="py-3 pl-4 pr-2">
                      <button
                        onClick={() => toggle(row.id)}
                        className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                          isSelected ? 'border-teal-500 bg-teal-500' : 'border-slate-300 bg-white hover:border-teal-400'
                        }`}
                      >
                        {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                      </button>
                    </td>
                    <td className="py-3 pl-2 pr-3">
                      <div className="font-medium text-slate-900 text-sm truncate max-w-[180px]">
                        {row.storeName ?? 'Unknown Store'}
                      </div>
                      {row.duplicateOfReceiptId && (
                        <span className="text-[10px] text-amber-600 font-medium">Possible duplicate</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-slate-500 whitespace-nowrap">{date}</td>
                    <td className="px-3 py-3 text-sm text-slate-500 text-center">
                      {row.status === 'done' ? (row._count?.items ?? 0) : '—'}
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-slate-900 text-right whitespace-nowrap">
                      {row.status === 'done' && row.grandTotal != null ? `$${row.grandTotal.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill status={row.status} reviewStatus={row.reviewStatus} />
                    </td>
                    <td className="px-3 py-3">
                      {row.syncStatus === 'synced' && (
                        <span className="text-[11px] text-emerald-600 font-medium">Sheets ✓</span>
                      )}
                    </td>
                    <td className="py-3 pl-3 pr-4">
                      <Link
                        href={`/receipts/${row.id}`}
                        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-teal-700 hover:bg-teal-50 transition-colors"
                      >
                        View <ArrowUpRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1">
          {page > 1 && (
            <Link href={buildPageUrl(page - 1)}>
              <Button variant="outline" size="sm">Previous</Button>
            </Link>
          )}
          <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
          {page < totalPages && (
            <Link href={buildPageUrl(page + 1)}>
              <Button variant="outline" size="sm">Next</Button>
            </Link>
          )}
        </div>
      )}

      <BulkDeleteDialog
        open={confirmBulkDelete}
        onOpenChange={setConfirmBulkDelete}
        count={selected.size}
        onConfirm={handleBulkDelete}
        deleting={bulkDeleting}
      />
    </div>
  )
}
