import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { AppShell } from '@/components/layout/AppShell'
import { UploadButton } from '@/components/receipt/UploadButton'
import { DashboardSearch } from '@/components/receipt/DashboardSearch'
import { DashboardInsights } from '@/components/receipt/DashboardInsights'
import { DashboardReceiptTable } from '@/components/receipt/DashboardReceiptTable'

interface Props {
  searchParams: Promise<{
    search?: string; page?: string; from?: string
    to?: string; status?: string; review?: string
  }>
}

const QUICK_FILTERS = [
  { label: 'All',          status: '',       review: '' },
  { label: 'Needs Review', status: 'done',   review: 'needs_review' },
  { label: 'Approved',     status: 'done',   review: 'approved' },
  { label: 'Failed',       status: 'failed', review: '' },
] as const

export default async function DashboardPage({ searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')

  const params      = await searchParams
  const search      = params.search ?? ''
  const page        = Math.max(1, parseInt(params.page ?? '1'))
  const limit       = 15
  const fromDate    = params.from ? new Date(params.from) : undefined
  const toDate      = params.to   ? new Date(params.to)   : undefined
  const statusFilter = params.status ?? ''
  const reviewFilter = params.review ?? ''

  const where = {
    userId: session.user.id,
    ...(search        ? { storeName: { contains: search } } : {}),
    ...(statusFilter  ? { status: statusFilter }            : {}),
    ...(reviewFilter  ? { reviewStatus: reviewFilter }      : {}),
    ...(fromDate || toDate ? {
      uploadDate: {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate   ? { lte: new Date(toDate.getTime() + 86_400_000) } : {}),
      },
    } : {}),
  }

  const [receipts, total, needsReviewCount] = await Promise.all([
    db.receipt.findMany({
      where,
      orderBy: { uploadDate: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
      include: { _count: { select: { items: true } } },
    }),
    db.receipt.count({ where }),
    db.receipt.count({ where: { userId: session.user.id, status: 'done', reviewStatus: 'needs_review' } }),
  ])

  // Analytics — last 7 months of processed receipts
  const analyticsReceipts = await db.receipt.findMany({
    where: { userId: session.user.id, status: 'done', uploadDate: { gte: new Date(Date.now() - 210 * 24 * 60 * 60 * 1000) } },
    include: { items: true },
    orderBy: { uploadDate: 'desc' },
  })

  const now                = new Date()
  const currentMonthStart  = new Date(now.getFullYear(), now.getMonth(), 1)
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const previousMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

  const currentMonthReceipts  = analyticsReceipts.filter((r) => (r.purchaseDate ?? r.uploadDate) >= currentMonthStart)
  const previousMonthReceipts = analyticsReceipts.filter((r) => {
    const d = r.purchaseDate ?? r.uploadDate
    return d >= previousMonthStart && d <= previousMonthEnd
  })

  const currentSpend  = currentMonthReceipts.reduce((s, r) => s + (r.grandTotal ?? 0), 0)
  const previousSpend = previousMonthReceipts.reduce((s, r) => s + (r.grandTotal ?? 0), 0)
  const spendDelta    = previousSpend === 0 ? null : ((currentSpend - previousSpend) / previousSpend) * 100

  const categoryMap = new Map<string, number>()
  const storeMap    = new Map<string, number>()
  const trendMap    = new Map<string, number>()

  for (const r of analyticsReceipts) {
    const d = r.purchaseDate ?? r.uploadDate
    const mk = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    trendMap.set(mk, (trendMap.get(mk) ?? 0) + (r.grandTotal ?? 0))

    if (d >= currentMonthStart) {
      const sk = r.storeName ?? 'Unknown'
      storeMap.set(sk, (storeMap.get(sk) ?? 0) + (r.grandTotal ?? 0))
      for (const item of r.items) {
        const ck = item.category ?? 'Other'
        categoryMap.set(ck, (categoryMap.get(ck) ?? 0) + (item.lineTotal ?? 0))
      }
    }
  }

  const categoryTotals = Array.from(categoryMap.entries())
    .map(([category, total]) => ({ category, total: +total.toFixed(2) }))
    .sort((a, b) => b.total - a.total).slice(0, 6)

  const storeComparison = Array.from(storeMap.entries())
    .map(([store, total]) => ({ store: store.length > 18 ? `${store.slice(0, 18)}…` : store, total: +total.toFixed(2) }))
    .sort((a, b) => b.total - a.total).slice(0, 6)

  const monthlyTrend = Array.from(trendMap.entries())
    .map(([month, total]) => ({ month, total: +total.toFixed(2) })).slice(-6)

  const metricCards = [
    {
      label: 'This Month',
      value: `$${currentSpend.toFixed(2)}`,
      delta: spendDelta == null ? undefined : `${spendDelta >= 0 ? '+' : ''}${spendDelta.toFixed(1)}% vs last month`,
      positive: spendDelta != null ? spendDelta <= 0 : true,
      icon: 'spend' as const,
    },
    {
      label: 'Receipts',
      value: String(currentMonthReceipts.length),
      sub: 'this month',
      icon: 'receipts' as const,
    },
    {
      label: 'Needs Review',
      value: String(needsReviewCount),
      sub: needsReviewCount === 0 ? 'All caught up' : 'action needed',
      icon: 'review' as const,
    },
    {
      label: 'Top Store',
      value: storeComparison[0]?.store ?? '—',
      sub: storeComparison[0] ? `$${storeComparison[0].total.toFixed(2)} this month` : 'no data',
      icon: 'store' as const,
    },
  ]

  const totalPages = Math.ceil(total / limit)
  const activeTab  = QUICK_FILTERS.find((f) => f.status === statusFilter && f.review === reviewFilter) ?? QUICK_FILTERS[0]

  return (
    <AppShell title="Dashboard" actions={<UploadButton />}>
      <div className="px-4 sm:px-6 py-6 space-y-6 max-w-[1400px]">
        {/* Search */}
        <DashboardSearch
          defaultSearch={search}
          defaultFrom={params.from ?? ''}
          defaultTo={params.to ?? ''}
          defaultStatus={statusFilter}
        />

        {/* KPI + charts */}
        <DashboardInsights
          metricCards={metricCards}
          monthlyTrend={monthlyTrend}
          categoryTotals={categoryTotals}
          storeComparison={storeComparison}
        />

        {/* Receipt table */}
        <DashboardReceiptTable
          rows={receipts}
          total={total}
          totalPages={totalPages}
          page={page}
          activeTab={activeTab.label}
          hasFilters={!!(search || params.from || params.to || statusFilter || reviewFilter)}
          search={search}
          from={params.from ?? ''}
          to={params.to ?? ''}
          statusFilter={statusFilter}
          reviewFilter={reviewFilter}
        />
      </div>
    </AppShell>
  )
}
