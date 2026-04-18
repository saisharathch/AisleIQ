import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { deleteFile } from '@/lib/storage'
import { updateReceiptSchema } from '@/lib/validators'

type Params = { params: Promise<{ id: string }> }

// GET /api/receipts/:id
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const receipt = await db.receipt.findFirst({
    where: { id, userId: session.user.id },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  })

  if (!receipt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true, data: receipt })
}

// PATCH /api/receipts/:id
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = updateReceiptSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const receipt = await db.receipt.findFirst({ where: { id, userId: session.user.id } })
  if (!receipt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await db.receipt.update({ where: { id }, data: parsed.data })

  // Audit log
  for (const [field, newValue] of Object.entries(parsed.data)) {
    const oldValue = (receipt as Record<string, unknown>)[field]
    if (oldValue !== newValue) {
      await db.editLog.create({
        data: {
          userId: session.user.id,
          receiptId: id,
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

// DELETE /api/receipts/:id
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const receipt = await db.receipt.findFirst({ where: { id, userId: session.user.id } })
  if (!receipt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Delete file from storage
  if (receipt.fileUrl) {
    const key = receipt.fileUrl.startsWith('/uploads/')
      ? receipt.fileUrl.replace('/uploads/', '')
      : receipt.fileUrl
    await deleteFile(key)
  }

  await db.receipt.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
