import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { errorResponse } from '@/lib/api-errors'
import { buildPriceHistoryMap } from '@/lib/shopping-list'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return errorResponse(401, 'UNAUTHORIZED', 'You must be signed in.')

  const rawNames = req.nextUrl.searchParams.get('names')?.split(',') ?? []
  const names = rawNames
    .map((n) => n.trim())
    .filter((n) => n.length > 0 && n.length <= 200)
    .slice(0, 100)
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

  const result = buildPriceHistoryMap(pastItems as Array<{ item: string; unitPrice: number | null }>)

  return NextResponse.json({ ok: true, data: result })
}
