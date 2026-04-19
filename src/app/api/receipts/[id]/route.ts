import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { deleteFile } from '@/lib/storage'
import { updateReceiptSchema } from '@/lib/validators'
import { errorResponse, readJsonBody, validationErrorResponse } from '@/lib/api-errors'
import { buildReceiptSyncHash, getEditedSyncStatus } from '@/lib/receipt-state'
import { refreshDuplicateDetection } from '@/lib/duplicate-detection'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return errorResponse(401, 'UNAUTHORIZED', 'You must be signed in.')

  const { id } = await params
  const receipt = await db.receipt.findFirst({
    where: { id, userId: session.user.id },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  })

  if (!receipt) return errorResponse(404, 'RECEIPT_NOT_FOUND', 'Receipt not found.')
  return NextResponse.json({ ok: true, data: receipt })
}

export async function PATCH(req: NextRequest, { params }: Params) {
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

  const parsed = updateReceiptSchema.safeParse(body)
  if (!parsed.success) {
    return validationErrorResponse(parsed.error, 'Invalid receipt update.')
  }

  const data = parsed.data
  const baseUpdate = {
    ...(data.storeName !== undefined ? { storeName: data.storeName } : {}),
    ...(data.purchaseDate !== undefined ? { purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null } : {}),
    ...(data.notes !== undefined ? { notes: data.notes } : {}),
    ...(data.subtotal !== undefined ? { subtotal: data.subtotal } : {}),
    ...(data.totalTax !== undefined ? { totalTax: data.totalTax } : {}),
    ...(data.discount !== undefined ? { discount: data.discount } : {}),
    ...(data.grandTotal !== undefined ? { grandTotal: data.grandTotal } : {}),
    ...(data.duplicateOverride !== undefined ? { duplicateOverride: data.duplicateOverride } : {}),
    ...(data.paidBy !== undefined ? { paidBy: data.paidBy } : {}),
    ...(data.splitWith !== undefined ? { splitWith: data.splitWith } : {}),
  }

  const didEditCoreFields = Object.keys(baseUpdate).some((key) => key !== 'duplicateOverride')

  const nextSnapshot = {
    storeName: baseUpdate.storeName ?? receipt.storeName,
    purchaseDate: (baseUpdate.purchaseDate as Date | null | undefined) ?? receipt.purchaseDate,
    subtotal: baseUpdate.subtotal ?? receipt.subtotal,
    totalTax: baseUpdate.totalTax ?? receipt.totalTax,
    discount: baseUpdate.discount ?? receipt.discount,
    grandTotal: baseUpdate.grandTotal ?? receipt.grandTotal,
    notes: baseUpdate.notes ?? receipt.notes,
  }
  const nextSyncHash = buildReceiptSyncHash(nextSnapshot, receipt.items)

  const updated = await db.receipt.update({
    where: { id },
    data: {
      ...baseUpdate,
      ...(data.reviewStatus
        ? {
            reviewStatus: data.reviewStatus,
            reviewedAt: data.reviewStatus === 'approved' ? new Date() : null,
          }
        : {}),
      ...(didEditCoreFields
        ? {
            syncStatus: getEditedSyncStatus(receipt.syncStatus),
            syncErrorMessage: null,
            lastSyncHash: nextSyncHash,
          }
        : {}),
    },
  })

  for (const [field, newValue] of Object.entries({
    ...baseUpdate,
    ...(data.reviewStatus ? { reviewStatus: data.reviewStatus } : {}),
  })) {
    const oldValue = (receipt as Record<string, unknown>)[field]
    if (String(oldValue ?? '') !== String(newValue ?? '')) {
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

  if (didEditCoreFields || data.duplicateOverride !== undefined) {
    await refreshDuplicateDetection(id)
  }

  return NextResponse.json({ ok: true, data: updated })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return errorResponse(401, 'UNAUTHORIZED', 'You must be signed in.')

  const { id } = await params
  const receipt = await db.receipt.findFirst({ where: { id, userId: session.user.id } })
  if (!receipt) return errorResponse(404, 'RECEIPT_NOT_FOUND', 'Receipt not found.')

  if (receipt.fileUrl) {
    const key = receipt.fileUrl.startsWith('/uploads/')
      ? receipt.fileUrl.replace('/uploads/', '')
      : receipt.fileUrl
    await deleteFile(key)
  }

  await db.receipt.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
