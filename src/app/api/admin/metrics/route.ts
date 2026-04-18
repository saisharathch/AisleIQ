import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

  const [
    totalUsers,
    totalReceipts,
    receiptsToday,
    parseLogs,
    recentErrors,
    topStores,
    recentReceipts,
  ] = await Promise.all([
    db.user.count(),
    db.receipt.count(),
    db.receipt.count({ where: { uploadDate: { gte: today } } }),
    db.parseLog.findMany({ select: { success: true, duration: true } }),
    db.parseLog.findMany({
      where: { success: false },
      select: { receiptId: true, errorDetail: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    db.receipt.groupBy({
      by: ['storeName'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
      where: { storeName: { not: null } },
    }),
    db.receipt.findMany({
      where: { uploadDate: { gte: thirtyDaysAgo } },
      select: { uploadDate: true },
      orderBy: { uploadDate: 'asc' },
    }),
  ])

  const successCount = parseLogs.filter((l) => l.success).length
  const avgMs =
    parseLogs.length > 0 ? Math.round(parseLogs.reduce((s, l) => s + l.duration, 0) / parseLogs.length) : 0

  // Build uploads-per-day for last 30 days
  const dayMap = new Map<string, number>()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000)
    dayMap.set(d.toISOString().slice(0, 10), 0)
  }
  for (const r of recentReceipts) {
    const key = r.uploadDate.toISOString().slice(0, 10)
    if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) ?? 0) + 1)
  }
  const uploadsPerDay = Array.from(dayMap.entries()).map(([date, count]) => ({ date, count }))

  return NextResponse.json({
    ok: true,
    data: {
      totalUsers,
      totalReceipts,
      receiptsToday,
      parseSuccessRate: parseLogs.length > 0 ? Math.round((successCount / parseLogs.length) * 100) : 100,
      avgProcessingMs: avgMs,
      failedParses: parseLogs.length - successCount,
      recentErrors,
      topStores: topStores.map((r) => ({ storeName: r.storeName ?? 'Unknown', count: r._count.id })),
      uploadsPerDay,
    },
  })
}
