import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { errorResponse } from '@/lib/api-errors'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return errorResponse(401, 'UNAUTHORIZED', 'You must be signed in.')

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)

  const items = await db.receiptItem.findMany({
    where: {
      receipt: {
        userId: session.user.id,
        status: 'done',
        uploadDate: { gte: ninetyDaysAgo },
      },
    },
    select: {
      item: true,
      category: true,
      unitPrice: true,
      lineTotal: true,
      quantity: true,
      receipt: { select: { uploadDate: true, storeName: true } },
    },
  })

  // Group by normalized item name
  const map = new Map<string, {
    name: string
    category: string | null
    prices: number[]
    stores: string[]
    dates: Date[]
    count: number
  }>()

  for (const i of items) {
    const key = i.item.trim().toLowerCase()
    const existing = map.get(key)
    const price = i.unitPrice ?? (i.lineTotal && i.quantity ? i.lineTotal / i.quantity : i.lineTotal)
    if (existing) {
      existing.count++
      if (price != null) existing.prices.push(price)
      if (i.receipt.storeName) existing.stores.push(i.receipt.storeName)
      existing.dates.push(i.receipt.uploadDate)
    } else {
      map.set(key, {
        name: i.item.trim(),
        category: i.category,
        prices: price != null ? [price] : [],
        stores: i.receipt.storeName ? [i.receipt.storeName] : [],
        dates: [i.receipt.uploadDate],
        count: 1,
      })
    }
  }

  const suggestions = Array.from(map.values())
    .filter((v) => v.count >= 2)
    .map((v) => {
      const avgPrice = v.prices.length > 0
        ? v.prices.reduce((a, b) => a + b, 0) / v.prices.length
        : null
      const lastBought = new Date(Math.max(...v.dates.map((d) => d.getTime())))
      const topStore = v.stores.length > 0
        ? v.stores.sort((a, b) =>
            v.stores.filter((s) => s === b).length - v.stores.filter((s) => s === a).length,
          )[0]
        : null
      return {
        name: v.name,
        category: v.category,
        avgPrice: avgPrice != null ? +avgPrice.toFixed(2) : null,
        count: v.count,
        lastBought: lastBought.toISOString(),
        topStore,
      }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 50)

  return NextResponse.json({ ok: true, data: suggestions })
}
