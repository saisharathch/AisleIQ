import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { receiptItemSchema } from '@/lib/validators'
import { errorResponse, readJsonBody, validationErrorResponse } from '@/lib/api-errors'
import { predictLearnedCategory } from '@/lib/category-learning'
import { refreshDuplicateDetection } from '@/lib/duplicate-detection'
import { buildReceiptSyncHash, getEditedSyncStatus } from '@/lib/receipt-state'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return errorResponse(401, 'UNAUTHORIZED', 'You must be signed in.')

  const { id } = await params
  const receipt = await db.receipt.findFirst({ where: { id, userId: session.user.id } })
  if (!receipt) return errorResponse(404, 'RECEIPT_NOT_FOUND', 'Receipt not found.')

  const items = await db.receiptItem.findMany({
    where: { receiptId: id },
    orderBy: { sortOrder: 'asc' },
  })

  return NextResponse.json({ ok: true, data: items })
}

export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return errorResponse(401, 'UNAUTHORIZED', 'You must be signed in.')

  const { id } = await params
  const receipt = await db.receipt.findFirst({
    where: { id, userId: session.user.id },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!receipt) return errorResponse(404, 'RECEIPT_NOT_FOUND', 'Receipt not found.')

  let body: unknown
  try {
    body = await readJsonBody(req)
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  const parsed = receiptItemSchema.safeParse(body)
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, 'Invalid receipt item.')
  }

  const lastItem = await db.receiptItem.findFirst({
    where: { receiptId: id },
    orderBy: { sortOrder: 'desc' },
  })

  const category = parsed.data.category ?? await predictLearnedCategory(session.user.id, parsed.data.item)
  const item = await db.receiptItem.create({
    data: {
      receiptId: id,
      store: receipt.storeName,
      sortOrder: (lastItem?.sortOrder ?? -1) + 1,
      confidence: 1.0,
      needsReview: false,
      ...parsed.data,
      category,
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

  const refreshedItems = [...receipt.items, item]
  await db.receipt.update({
    where: { id },
    data: {
      syncStatus: getEditedSyncStatus(receipt.syncStatus),
      syncErrorMessage: null,
      lastSyncHash: buildReceiptSyncHash(receipt, refreshedItems),
    },
  })
  await refreshDuplicateDetection(id)

  return NextResponse.json({ ok: true, data: item }, { status: 201 })
}
