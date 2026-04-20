import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { AppShell } from '@/components/layout/AppShell'
import { AnalyticsDashboard } from '@/components/receipt/AnalyticsDashboard'
import { MonthlyDigestButton } from '@/components/analytics/MonthlyDigestButton'

export default async function AnalyticsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')

  const userId = session.user.id

  // Fetch all processed receipts with items for analytics
  const receipts = await db.receipt.findMany({
    where: { userId, status: 'done' },
    include: { items: true },
    orderBy: { uploadDate: 'asc' },
  })

  const now               = new Date()
  const twelveMonthsAgo   = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const prevMonthStart    = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonthEnd      = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)

  // Build monthly totals for 12 months
  const trendMap = new Map<string, { total: number; count: number }>()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    trendMap.set(key, { total: 0, count: 0 })
  }

  const categoryMap = new Map<string, number>()
  const storeMap    = new Map<string, number>()
  const itemMap     = new Map<string, number>()
  let totalAllTime  = 0
  let totalThisMonth = 0
  let totalLastMonth = 0
  let countThisMonth = 0
  let countLastMonth = 0

  for (const r of receipts) {
    const d   = r.purchaseDate ?? r.uploadDate
    const amt = r.grandTotal ?? 0
    totalAllTime += amt

    const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
    if (trendMap.has(key)) {
      const cur = trendMap.get(key)!
      trendMap.set(key, { total: cur.total + amt, count: cur.count + 1 })
    }

    if (d >= currentMonthStart) {
      totalThisMonth += amt
      countThisMonth++
      const sk = r.storeName ?? 'Unknown'
      storeMap.set(sk, (storeMap.get(sk) ?? 0) + amt)
    }
    if (d >= prevMonthStart && d <= prevMonthEnd) {
      totalLastMonth += amt
      countLastMonth++
    }

    for (const item of r.items) {
      const ck = item.category ?? 'Other'
      categoryMap.set(ck, (categoryMap.get(ck) ?? 0) + (item.lineTotal ?? 0))

      const ik = item.item.trim().toLowerCase()
      itemMap.set(ik, (itemMap.get(ik) ?? 0) + (item.lineTotal ?? 0))
    }
  }

  const monthlyTrend = Array.from(trendMap.entries()).map(([month, { total, count }]) => ({
    month, total: +total.toFixed(2), count,
  }))

  const categoryTotals = Array.from(categoryMap.entries())
    .map(([category, total]) => ({ category, total: +total.toFixed(2) }))
    .sort((a, b) => b.total - a.total)

  const storeComparison = Array.from(storeMap.entries())
    .map(([store, total]) => ({
      store: store.length > 20 ? `${store.slice(0, 20)}…` : store,
      total: +total.toFixed(2),
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8)

  const topItems = Array.from(itemMap.entries())
    .map(([item, total]) => ({ item, total: +total.toFixed(2) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  const spendDelta = totalLastMonth === 0 ? null
    : ((totalThisMonth - totalLastMonth) / totalLastMonth) * 100

  const avgReceipt = receipts.length === 0 ? 0
    : +(totalAllTime / receipts.length).toFixed(2)

  const recentReceipts = receipts
    .filter((r) => (r.purchaseDate ?? r.uploadDate) >= twelveMonthsAgo)

  return (
    <AppShell
      title="Analytics"
      actions={
        <MonthlyDigestButton
          monthlyTrend={monthlyTrend}
          categoryTotals={categoryTotals}
          storeComparison={storeComparison}
          topItems={topItems}
          totalThisMonth={+totalThisMonth.toFixed(2)}
          totalLastMonth={+totalLastMonth.toFixed(2)}
          countThisMonth={countThisMonth}
        />
      }
    >
      <div className="px-4 sm:px-6 py-6 max-w-[1400px]">
        <AnalyticsDashboard
          monthlyTrend={monthlyTrend}
          categoryTotals={categoryTotals}
          storeComparison={storeComparison}
          topItems={topItems}
          totalAllTime={+totalAllTime.toFixed(2)}
          totalThisMonth={+totalThisMonth.toFixed(2)}
          totalLastMonth={+totalLastMonth.toFixed(2)}
          spendDelta={spendDelta}
          avgReceipt={avgReceipt}
          totalReceipts={receipts.length}
          countThisMonth={countThisMonth}
          countLastMonth={countLastMonth}
          recentReceiptCount={recentReceipts.length}
        />
      </div>
    </AppShell>
  )
}
