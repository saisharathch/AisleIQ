import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { errorResponse } from '@/lib/api-errors'
import { buildShoppingSuggestions } from '@/lib/shopping-list'

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

  const suggestions = buildShoppingSuggestions(items)

  return NextResponse.json({ ok: true, data: suggestions })
}
