import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { errorResponse } from '@/lib/api-errors'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return errorResponse(401, 'UNAUTHORIZED', 'You must be signed in.')

  const names = req.nextUrl.searchParams.get('names')?.split(',').filter(Boolean) ?? []
  const excludeReceiptId = req.nextUrl.searchParams.get('excludeReceiptId') ?? undefined

  if (names.length === 0) return NextResponse.json({ ok: true, data: {} })

  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000)

  const pastItems = await db.receiptItem.findMany({
    where: {
      item: { in: names },
      unitPrice: { not: null },
      receipt: {
        userId: session.user.id,
        status: 'done',
        uploadDate: { gte: sixMonthsAgo },
        ...(excludeReceiptId ? { id: { not: excludeReceiptId } } : {}),
      },
    },
    select: { item: true, unitPrice: true },
  })

  const priceMap: Record<string, number[]> = {}
  for (const pi of pastItems) {
    const key = pi.item.trim().toLowerCase()
    if (!priceMap[key]) priceMap[key] = []
    priceMap[key].push(pi.unitPrice!)
  }

  const result: Record<string, { avg: number; count: number }> = {}
  for (const [key, prices] of Object.entries(priceMap)) {
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length
    result[key] = { avg: +avg.toFixed(4), count: prices.length }
  }

  return NextResponse.json({ ok: true, data: result })
}
