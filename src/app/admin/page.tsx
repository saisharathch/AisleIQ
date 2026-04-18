import { redirect } from 'next/navigation'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { Navbar } from '@/components/layout/Navbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { UploadsChart, TopStoresChart } from '@/components/admin/AdminCharts'
import { formatCurrency } from '@/lib/calculations'
import { Users, Receipt, CheckCircle, Clock, XCircle, TrendingUp } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default async function AdminPage() {
  try {
    await requireAdmin()
  } catch {
    redirect('/dashboard')
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [totalUsers, totalReceipts, receiptsToday, parseLogs, topStores, recentErrors, recentUploads, latestReceipts] =
    await Promise.all([
      db.user.count(),
      db.receipt.count(),
      db.receipt.count({ where: { uploadDate: { gte: today } } }),
      db.parseLog.findMany({ select: { success: true, duration: true } }),
      db.receipt.groupBy({
        by: ['storeName'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 8,
        where: { storeName: { not: null } },
      }),
      db.parseLog.findMany({
        where: { success: false },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { receiptId: true, errorDetail: true, createdAt: true },
      }),
      db.receipt.findMany({
        where: { uploadDate: { gte: thirtyDaysAgo } },
        select: { uploadDate: true },
        orderBy: { uploadDate: 'asc' },
      }),
      db.receipt.findMany({
        orderBy: { uploadDate: 'desc' },
        take: 10,
        include: {
          user: { select: { name: true, email: true } },
          _count: { select: { items: true } },
        },
      }),
    ])

  const successCount = parseLogs.filter((l) => l.success).length
  const successRate = parseLogs.length > 0 ? Math.round((successCount / parseLogs.length) * 100) : 100
  const avgMs =
    parseLogs.length > 0
      ? Math.round(parseLogs.reduce((s, l) => s + l.duration, 0) / parseLogs.length)
      : 0

  // Build uploads-per-day series
  const dayMap = new Map<string, number>()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000)
    dayMap.set(d.toISOString().slice(0, 10), 0)
  }
  for (const r of recentUploads) {
    const key = r.uploadDate.toISOString().slice(0, 10)
    if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) ?? 0) + 1)
  }
  const uploadsPerDay = Array.from(dayMap.entries()).map(([date, count]) => ({ date, count }))
  const topStoresData = topStores.map((s) => ({ storeName: s.storeName ?? 'Unknown', count: s._count.id }))

  const metrics = [
    { label: 'Total Users', value: totalUsers, icon: Users, color: 'text-blue-600' },
    { label: 'Total Receipts', value: totalReceipts, icon: Receipt, color: 'text-primary' },
    { label: 'Uploaded Today', value: receiptsToday, icon: TrendingUp, color: 'text-green-600' },
    { label: 'Parse Success Rate', value: `${successRate}%`, icon: CheckCircle, color: 'text-green-600' },
    { label: 'Avg Processing', value: `${avgMs}ms`, icon: Clock, color: 'text-amber-600' },
    { label: 'Failed Parses', value: parseLogs.length - successCount, icon: XCircle, color: 'text-red-600' },
  ]

  const statusBadgeVariant = (status: string) => {
    if (status === 'done') return 'success' as const
    if (status === 'failed') return 'destructive' as const
    return 'secondary' as const
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1 container py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground">Usage metrics and error monitoring</p>
        </div>

        {/* Metric cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <Icon className={`h-4 w-4 ${color}`} />
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Uploads per Day (last 30 days)</CardTitle>
            </CardHeader>
            <CardContent>
              <UploadsChart data={uploadsPerDay} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Stores</CardTitle>
            </CardHeader>
            <CardContent>
              {topStoresData.length > 0 ? (
                <TopStoresChart data={topStoresData} />
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No store data yet</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent receipts table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Recent Uploads (all users)</CardTitle>
            <span className="text-sm text-muted-foreground">{totalReceipts} total</span>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {['User', 'Store', 'Items', 'Total', 'Status', 'Uploaded'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {latestReceipts.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium truncate max-w-[140px]">{r.user.name ?? '—'}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[140px]">{r.user.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/receipts/${r.id}`} className="hover:underline text-primary truncate max-w-[140px] block">
                          {r.storeName ?? 'Unknown'}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r._count.items}</td>
                      <td className="px-4 py-3 font-medium">{formatCurrency(r.grandTotal)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusBadgeVariant(r.status)} className="capitalize">{r.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {formatDistanceToNow(new Date(r.uploadDate), { addSuffix: true })}
                      </td>
                    </tr>
                  ))}
                  {latestReceipts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                        No receipts yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Recent parse errors */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Parse Failures</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentErrors.map((err) => (
                <div key={`${err.receiptId}-${err.createdAt.toISOString()}`} className="space-y-0.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <code className="bg-muted px-1.5 py-0.5 rounded">{err.receiptId.slice(0, 12)}…</code>
                    <span>{formatDistanceToNow(new Date(err.createdAt), { addSuffix: true })}</span>
                  </div>
                  <p className="text-sm text-destructive truncate">{err.errorDetail ?? 'Unknown error'}</p>
                </div>
              ))}
              {recentErrors.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No failures — great!
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
