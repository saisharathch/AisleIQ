import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { uploadReceiptToSheets, categorizeItem } from '@/lib/google-sheets'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const receipt = await db.receipt.findUnique({
      where: { id, userId: user.id },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    })

    if (!receipt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (receipt.status !== 'done') {
      return NextResponse.json({ error: 'Receipt not fully processed yet' }, { status: 400 })
    }

    // Duplicate prevention
    if (receipt.sheetsUploadId) {
      const sheetUrl = `https://docs.google.com/spreadsheets/d/${receipt.sheetsUploadId}`
      return NextResponse.json(
        { error: 'Already uploaded to Sheets', code: 'DUPLICATE', sheetUrl },
        { status: 409 },
      )
    }

    const body = await req.json().catch(() => ({}))
    const categoryOverrides: Record<string, string> = body.categories ?? {}

    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { sheetsSpreadsheetId: true },
    })

    const rows = receipt.items.map((item) => ({
      date: receipt.uploadDate.toISOString().split('T')[0],
      storeName: receipt.storeName ?? 'Unknown Store',
      item: item.item,
      category: categoryOverrides[item.id] ?? categorizeItem(item.item),
      quantity: item.quantity,
      price: item.unitPrice,
      lineTotal: item.lineTotal,
      tax: item.tax,
      grandTotal: receipt.grandTotal,
      paymentMethod: 'Unknown',
      notes: receipt.notes ?? '',
    }))

    const spreadsheetId = await uploadReceiptToSheets(
      user.id,
      dbUser?.sheetsSpreadsheetId ?? null,
      rows,
    )

    await Promise.all([
      db.user.update({ where: { id: user.id }, data: { sheetsSpreadsheetId: spreadsheetId } }),
      db.receipt.update({ where: { id }, data: { sheetsUploadId: spreadsheetId } }),
    ])

    return NextResponse.json({
      ok: true,
      spreadsheetId,
      sheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    })
  } catch (err: unknown) {
    const code = (err as Error).message
    const errorMap: Record<string, [string, number]> = {
      GOOGLE_NOT_CONNECTED: ['Google account not connected. Please sign in with Google.', 401],
      SHEETS_SCOPE_MISSING: ['Google Sheets permission missing. Please reconnect your Google account.', 403],
      GOOGLE_AUTH_EXPIRED: ['Google session expired. Please sign in with Google again.', 401],
      PERMISSION_DENIED: ['Google denied access to Sheets.', 403],
      NO_REFRESH_TOKEN: ['Cannot refresh Google token. Please sign in with Google again.', 401],
    }
    if (errorMap[code]) {
      const [error, status] = errorMap[code]
      return NextResponse.json({ error, code }, { status })
    }
    console.error('[sheets upload]', err)
    return NextResponse.json({ error: 'Failed to upload to Google Sheets' }, { status: 500 })
  }
}
