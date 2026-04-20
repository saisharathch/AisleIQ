import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { uploadReceiptToSheets, categorizeItem, getSheetsOwnerUser } from '@/lib/google-sheets'
import { errorResponse, readJsonBody, validationErrorResponse } from '@/lib/api-errors'
import { receiptItemSchema, sheetsSyncSchema } from '@/lib/validators'
import { learnCategoryPreference } from '@/lib/category-learning'
import { buildReceiptSyncHash } from '@/lib/receipt-state'
import { getGoogleSheetsOwnerEmail } from '@/lib/env'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAuth().catch(() => null)
  if (!user) return errorResponse(401, 'UNAUTHORIZED', 'You must be signed in.')

  const { id } = await params

  const receipt = await db.receipt.findFirst({
    where: { id, userId: user.id },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  })

  if (!receipt) return errorResponse(404, 'RECEIPT_NOT_FOUND', 'Receipt not found.')

  if (receipt.status !== 'done') {
    return errorResponse(
      400,
      'RECEIPT_NOT_READY',
      'Receipt has not finished processing yet. Wait for OCR to complete before syncing.',
    )
  }

  if (receipt.reviewStatus !== 'approved') {
    return errorResponse(
      409,
      'REVIEW_REQUIRED',
      'Review and approve this receipt before syncing it to Google Sheets.',
    )
  }

  if (receipt.items.length === 0) {
    return errorResponse(
      422,
      'RECEIPT_ITEMS_MISSING',
      'Receipt has no items to sync. Add at least one item first.',
    )
  }

  let categoryOverrides: Record<string, string> = {}
  let force = false

  try {
    const body = await readJsonBody(req)
    const parsed = sheetsSyncSchema.safeParse(body)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error, 'Invalid sync payload.')
    }

    categoryOverrides = parsed.data.categories
    force = parsed.data.force
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  const receiptItemIds = new Set(receipt.items.map((item) => item.id))
  const invalidCategoryKeys = Object.keys(categoryOverrides).filter((itemId) => !receiptItemIds.has(itemId))
  if (invalidCategoryKeys.length > 0) {
    return errorResponse(
      400,
      'INVALID_SYNC_PAYLOAD',
      'Sync payload included categories for receipt items that do not exist.',
      invalidCategoryKeys.map((itemId) => ({
        field: `categories.${itemId}`,
        message: 'Unknown receipt item.',
      })),
    )
  }

  const invalidReceiptItem = receipt.items.find((item) => !receiptItemSchema.safeParse({
    item: item.item,
    category: item.category ?? undefined,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
    tax: item.tax,
    needsReview: item.needsReview,
  }).success)
  if (invalidReceiptItem) {
    return errorResponse(
      422,
      'INVALID_RECEIPT_DATA',
      'Receipt contains invalid item data. Fix the item details before syncing to Sheets.',
      [{ field: invalidReceiptItem.id, message: 'Item data is incomplete or invalid.' }],
    )
  }

  const itemsWithCategories = receipt.items.map((item) => ({
    ...item,
    category: categoryOverrides[item.id] ?? item.category ?? categorizeItem(item.item),
  }))

  for (const item of itemsWithCategories) {
    if (item.category !== (receipt.items.find((candidate) => candidate.id === item.id)?.category ?? null)) {
      await db.receiptItem.update({
        where: { id: item.id },
        data: { category: item.category },
      })
      await learnCategoryPreference(user.id, item.item, item.category)
    }
  }

  const currentSyncHash = buildReceiptSyncHash(receipt, itemsWithCategories)
  if (
    receipt.sheetsUploadId &&
    receipt.syncStatus === 'synced' &&
    receipt.lastSyncHash === currentSyncHash &&
    !force
  ) {
    const sheetUrl = `https://docs.google.com/spreadsheets/d/${receipt.sheetsUploadId}`
    return NextResponse.json(
      {
        ok: false,
        error: 'This receipt was already synced to Google Sheets.',
        code: 'ALREADY_SYNCED',
        sheetUrl,
        syncedAt: receipt.sheetsSyncedAt,
        syncStatus: receipt.syncStatus,
      },
      { status: 409 },
    )
  }

  await db.receipt.update({
    where: { id },
    data: {
      syncStatus: 'syncing',
      syncErrorMessage: null,
      syncAttempts: { increment: 1 },
    },
  })

  const configuredOwnerEmail = getGoogleSheetsOwnerEmail()
  const sheetsOwner = configuredOwnerEmail
    ? await getSheetsOwnerUser()
    : await db.user.findUnique({
        where: { id: user.id },
        select: { id: true, email: true, sheetsSpreadsheetId: true },
      })

  if (configuredOwnerEmail && !sheetsOwner) {
    return errorResponse(
      503,
      'SHEETS_OWNER_NOT_READY',
      `The configured Google Sheets owner (${configuredOwnerEmail}) has not created an app account yet.`,
    )
  }

  const rows = itemsWithCategories.map((item) => ({
    receiptId: receipt.id,
    date: (receipt.purchaseDate ?? receipt.uploadDate).toISOString().split('T')[0],
    storeName: receipt.storeName ?? 'Unknown Store',
    item: item.item,
    category: item.category ?? 'Other',
    quantity: item.quantity,
    price: item.unitPrice,
    lineTotal: item.lineTotal,
    tax: item.tax,
    grandTotal: receipt.grandTotal,
    paymentMethod: 'Unknown',
    notes: receipt.notes ?? '',
  }))

  try {
    const spreadsheetId = await uploadReceiptToSheets(
      sheetsOwner!.id,
      sheetsOwner?.sheetsSpreadsheetId ?? null,
      rows,
    )

    const syncedAt = new Date()
    await Promise.all([
      db.user.update({
        where: { id: sheetsOwner!.id },
        data: { sheetsSpreadsheetId: spreadsheetId },
      }),
      db.receipt.update({
        where: { id },
        data: {
          sheetsUploadId: spreadsheetId,
          sheetsSyncedAt: syncedAt,
          syncStatus: 'synced',
          syncErrorMessage: null,
          lastSyncHash: currentSyncHash,
        },
      }),
    ])

    return NextResponse.json({
      ok: true,
      spreadsheetId,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      syncedAt: syncedAt.toISOString(),
      syncStatus: 'synced',
      ownerEmail: sheetsOwner?.email ?? user.email ?? null,
    })
  } catch (err: unknown) {
    const code = err instanceof Error ? err.message : ''

    const errorMap: Record<string, [string, number]> = {
      GOOGLE_NOT_CONNECTED: ['Google account not connected. Please sign in with Google.', 401],
      SHEETS_SCOPE_MISSING: ['Google Sheets permission not granted. Please reconnect your Google account and allow Sheets access.', 403],
      GOOGLE_AUTH_EXPIRED: ['Your Google session has expired. Please sign in with Google again.', 401],
      PERMISSION_DENIED: ['Google denied access to Sheets. Check that your account has Sheets enabled.', 403],
      NO_REFRESH_TOKEN: ['Cannot silently refresh Google token. Please sign in with Google again.', 401],
      SHEET_NOT_FOUND: ['The spreadsheet was deleted. A new one will be created on the next sync. Please try again.', 404],
      SHEETS_OWNER_NOT_READY: ['The shared Google Sheets owner account is not ready yet.', 503],
    }

    await db.receipt.update({
      where: { id },
      data: {
        syncStatus: 'failed',
        syncErrorMessage: code || 'SHEETS_SYNC_FAILED',
      },
    })

    if (errorMap[code]) {
      const [error, status] = errorMap[code]
      return errorResponse(status, code, error)
    }

    console.error('[sheets sync]', err)
    return errorResponse(500, 'SHEETS_SYNC_FAILED', 'Failed to sync to Google Sheets. Please try again.')
  }
}
