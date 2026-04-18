import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { receiptItemSchema } from '@/lib/validators'

type Params = { params: Promise<{ id: string; itemId: string }> }

async function getAuthorizedItem(receiptId: string, itemId: string, userId: string) {
  const receipt = await db.receipt.findFirst({ where: { id: receiptId, userId } })
  if (!receipt) return null
  return db.receiptItem.findFirst({ where: { id: itemId, receiptId } })
}

// PATCH /api/receipts/:id/items/:itemId
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, itemId } = await params
  const item = await getAuthorizedItem(id, itemId, session.user.id)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const parsed = receiptItemSchema.partial().safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const updated = await db.receiptItem.update({ where: { id: itemId }, data: parsed.data })

  // Log each changed field
  for (const [field, newValue] of Object.entries(parsed.data)) {
    const oldValue = (item as Record<string, unknown>)[field]
    if (oldValue !== newValue) {
      await db.editLog.create({
        data: {
          userId: session.user.id,
          receiptId: id,
          receiptItemId: itemId,
          field,
          oldValue: String(oldValue ?? ''),
          newValue: String(newValue ?? ''),
          action: 'update',
        },
      })
    }
  }

  return NextResponse.json({ ok: true, data: updated })
}

// DELETE /api/receipts/:id/items/:itemId
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, itemId } = await params
  const item = await getAuthorizedItem(id, itemId, session.user.id)
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.receiptItem.delete({ where: { id: itemId } })

  await db.editLog.create({
    data: {
      userId: session.user.id,
      receiptId: id,
      receiptItemId: itemId,
      field: 'item',
      oldValue: item.item,
      action: 'delete',
    },
  })

  return NextResponse.json({ ok: true })
}
