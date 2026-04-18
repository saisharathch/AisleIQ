import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { receiptItemSchema } from '@/lib/validators'

type Params = { params: Promise<{ id: string }> }

// GET /api/receipts/:id/items
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const receipt = await db.receipt.findFirst({ where: { id, userId: session.user.id } })
  if (!receipt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const items = await db.receiptItem.findMany({
    where: { receiptId: id },
    orderBy: { sortOrder: 'asc' },
  })

  return NextResponse.json({ ok: true, data: items })
}

// POST /api/receipts/:id/items — add a new row
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const receipt = await db.receipt.findFirst({ where: { id, userId: session.user.id } })
  if (!receipt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = receiptItemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const lastItem = await db.receiptItem.findFirst({
    where: { receiptId: id },
    orderBy: { sortOrder: 'desc' },
  })

  const item = await db.receiptItem.create({
    data: {
      receiptId: id,
      store: receipt.storeName,
      sortOrder: (lastItem?.sortOrder ?? -1) + 1,
      confidence: 1.0,
      needsReview: false,
      ...parsed.data,
    },
  })

  await db.editLog.create({
    data: {
      userId: session.user.id,
      receiptId: id,
      receiptItemId: item.id,
      field: 'item',
      newValue: item.item,
      action: 'create',
    },
  })

  return NextResponse.json({ ok: true, data: item }, { status: 201 })
}
