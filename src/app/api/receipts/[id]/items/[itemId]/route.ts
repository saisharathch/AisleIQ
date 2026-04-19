import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { receiptItemSchema } from '@/lib/validators'
import { errorResponse, readJsonBody, validationErrorResponse } from '@/lib/api-errors'
import { buildReceiptSyncHash, getEditedSyncStatus } from '@/lib/receipt-state'
import { learnCategoryPreference } from '@/lib/category-learning'
import { refreshDuplicateDetection } from '@/lib/duplicate-detection'

type Params = { params: Promise<{ id: string; itemId: string }> }

async function getAuthorizedReceiptWithItem(receiptId: string, itemId: string, userId: string) {
  const receipt = await db.receipt.findFirst({
    where: { id: receiptId, userId },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!receipt) return null

  const item = receipt.items.find((candidate) => candidate.id === itemId) ?? null
  if (!item) return null

  return { receipt, item }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return errorResponse(401, 'UNAUTHORIZED', 'You must be signed in.')

  const { id, itemId } = await params
  const authorized = await getAuthorizedReceiptWithItem(id, itemId, session.user.id)
  if (!authorized) return errorResponse(404, 'RECEIPT_ITEM_NOT_FOUND', 'Receipt item not found.')

  let body: unknown
  try {
    body = await readJsonBody(req)
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  const parsed = receiptItemSchema.partial().safeParse(body)
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, 'Invalid receipt item update.')
  }

  const updated = await db.receiptItem.update({ where: { id: itemId }, data: parsed.data })

  for (const [field, newValue] of Object.entries(parsed.data)) {
    const oldValue = (authorized.item as Record<string, unknown>)[field]
    if (String(oldValue ?? '') !== String(newValue ?? '')) {
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

  if (parsed.data.category && parsed.data.category !== authorized.item.category) {
    await learnCategoryPreference(session.user.id, updated.item, parsed.data.category)
  }

  const refreshedItems = authorized.receipt.items.map((item) => (item.id === itemId ? updated : item))
  await db.receipt.update({
    where: { id },
    data: {
      syncStatus: getEditedSyncStatus(authorized.receipt.syncStatus),
      syncErrorMessage: null,
      lastSyncHash: buildReceiptSyncHash(authorized.receipt, refreshedItems),
    },
  })
  await refreshDuplicateDetection(id)

  return NextResponse.json({ ok: true, data: updated })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return errorResponse(401, 'UNAUTHORIZED', 'You must be signed in.')

  const { id, itemId } = await params
  const authorized = await getAuthorizedReceiptWithItem(id, itemId, session.user.id)
  if (!authorized) return errorResponse(404, 'RECEIPT_ITEM_NOT_FOUND', 'Receipt item not found.')

  await db.receiptItem.delete({ where: { id: itemId } })

  await db.editLog.create({
    data: {
      userId: session.user.id,
      receiptId: id,
      receiptItemId: itemId,
      field: 'item',
      oldValue: authorized.item.item,
      action: 'delete',
    },
  })

  const refreshedItems = authorized.receipt.items.filter((item) => item.id !== itemId)
  await db.receipt.update({
    where: { id },
    data: {
      syncStatus: getEditedSyncStatus(authorized.receipt.syncStatus),
      syncErrorMessage: null,
      lastSyncHash: buildReceiptSyncHash(authorized.receipt, refreshedItems),
    },
  })
  await refreshDuplicateDetection(id)

  return NextResponse.json({ ok: true })
}
