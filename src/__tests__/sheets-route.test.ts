/** @jest-environment node */

import { NextRequest } from 'next/server'
import { POST as syncReceiptToSheets } from '@/app/api/receipts/[id]/sheets/route'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'
import { getSheetsOwnerUser, uploadReceiptToSheets } from '@/lib/google-sheets'

jest.mock('@/lib/auth', () => ({
  requireAuth: jest.fn(),
}))

jest.mock('@/lib/db', () => ({
  db: {
    receipt: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    receiptItem: {
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    categoryPreference: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}))

jest.mock('@/lib/google-sheets', () => ({
  ITEM_CATEGORIES: [
    'Produce', 'Dairy', 'Meat', 'Bakery', 'Frozen',
    'Snacks', 'Beverages', 'Household', 'Personal Care', 'Other',
  ],
  uploadReceiptToSheets: jest.fn(),
  getSheetsOwnerUser: jest.fn(),
  categorizeItem: jest.fn((item: string) => (item.toLowerCase().includes('milk') ? 'Dairy' : 'Other')),
}))

const mockedRequireAuth = jest.mocked(requireAuth)
const mockedDb = db as unknown as {
  receipt: {
    findFirst: jest.Mock
    update: jest.Mock
  }
  receiptItem: {
    update: jest.Mock
  }
  user: {
    findUnique: jest.Mock
    update: jest.Mock
  }
  categoryPreference: {
    upsert: jest.Mock
    findUnique: jest.Mock
  }
}
const mockedUploadReceiptToSheets = jest.mocked(uploadReceiptToSheets)
const mockedGetSheetsOwnerUser = jest.mocked(getSheetsOwnerUser)

function makeReceipt(overrides: Record<string, unknown> = {}) {
  return {
    id: 'receipt-1',
    userId: 'user-1',
    storeName: 'Walmart',
    status: 'done',
    purchaseDate: new Date('2024-01-01T10:00:00.000Z'),
    reviewStatus: 'approved',
    syncStatus: 'not_synced',
    syncErrorMessage: null,
    syncAttempts: 0,
    lastSyncHash: null,
    duplicateOfReceiptId: null,
    duplicateScore: null,
    duplicateReason: null,
    duplicateOverride: false,
    sheetsUploadId: null,
    sheetsSyncedAt: null,
    grandTotal: 12.34,
    notes: null,
    uploadDate: new Date('2024-01-01T10:00:00.000Z'),
    items: [
      {
        id: 'item-1',
        item: 'Milk',
        category: 'Dairy',
        quantity: 1,
        unitPrice: 3.99,
        lineTotal: 3.99,
        tax: 0,
        needsReview: false,
        sortOrder: 0,
      },
    ],
    ...overrides,
  }
}

async function readJson(res: Response) {
  return res.json()
}

describe('google sheets pilot sync route', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedRequireAuth.mockResolvedValue({ id: 'user-1' } as never)
    mockedDb.receipt.findFirst.mockResolvedValue(makeReceipt())
    mockedDb.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user-1@example.com',
      sheetsSpreadsheetId: 'sheet-existing',
    })
    mockedDb.user.update.mockResolvedValue({ id: 'user-1' })
    mockedDb.receipt.update.mockResolvedValue({ id: 'receipt-1' })
    mockedDb.receiptItem.update.mockResolvedValue({ id: 'item-1' })
    mockedDb.categoryPreference.upsert.mockResolvedValue({ id: 'pref-1' })
    mockedDb.categoryPreference.findUnique.mockResolvedValue(null)
    mockedUploadReceiptToSheets.mockResolvedValue('sheet-123')
    mockedGetSheetsOwnerUser.mockResolvedValue(null)
  })

  afterEach(() => {
    delete process.env.GOOGLE_SHEETS_OWNER_EMAIL
  })

  it('syncs a processed receipt to Google Sheets', async () => {
    const req = new NextRequest('http://localhost/api/receipts/receipt-1/sheets', {
      method: 'POST',
      body: JSON.stringify({ categories: { 'item-1': 'Dairy' }, force: false }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await syncReceiptToSheets(req, { params: Promise.resolve({ id: 'receipt-1' }) })
    const body = await readJson(res)

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mockedUploadReceiptToSheets).toHaveBeenCalledWith(
      'user-1',
      'sheet-existing',
      expect.arrayContaining([
        expect.objectContaining({
          receiptId: 'receipt-1',
          item: 'Milk',
          category: 'Dairy',
        }),
      ]),
    )
    expect(mockedDb.user.update).toHaveBeenCalled()
    expect(mockedDb.receipt.update).toHaveBeenCalled()
  })

  it('uses the configured shared sheet owner when present', async () => {
    process.env.GOOGLE_SHEETS_OWNER_EMAIL = 'owner@example.com'
    mockedGetSheetsOwnerUser.mockResolvedValueOnce({
      id: 'owner-user',
      email: 'owner@example.com',
      sheetsSpreadsheetId: 'sheet-owner',
    } as never)

    const req = new NextRequest('http://localhost/api/receipts/receipt-1/sheets', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await syncReceiptToSheets(req, { params: Promise.resolve({ id: 'receipt-1' }) })
    const body = await readJson(res)

    expect(res.status).toBe(200)
    expect(body.ownerEmail).toBe('owner@example.com')
    expect(mockedUploadReceiptToSheets).toHaveBeenCalledWith(
      'owner-user',
      'sheet-owner',
      expect.any(Array),
    )
    expect(mockedDb.user.update).toHaveBeenCalledWith({
      where: { id: 'owner-user' },
      data: { sheetsSpreadsheetId: 'sheet-123' },
    })
  })

  it('prevents duplicate sync unless force is enabled', async () => {
    mockedDb.receipt.findFirst.mockResolvedValueOnce(makeReceipt({
      sheetsUploadId: 'sheet-123',
      sheetsSyncedAt: new Date('2024-01-02T10:00:00.000Z'),
      syncStatus: 'synced',
      lastSyncHash: JSON.stringify({
        storeName: 'Walmart',
        purchaseDate: '2024-01-01T10:00:00.000Z',
        subtotal: null,
        totalTax: null,
        discount: null,
        grandTotal: 12.34,
        notes: '',
        items: [{
          item: 'Milk',
          category: 'Dairy',
          quantity: 1,
          unitPrice: 3.99,
          lineTotal: 3.99,
          tax: 0,
        }],
      }),
    }))

    const req = new NextRequest('http://localhost/api/receipts/receipt-1/sheets', {
      method: 'POST',
      body: JSON.stringify({ categories: {}, force: false }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await syncReceiptToSheets(req, { params: Promise.resolve({ id: 'receipt-1' }) })
    const body = await readJson(res)

    expect(res.status).toBe(409)
    expect(body.code).toBe('ALREADY_SYNCED')
    expect(mockedUploadReceiptToSheets).not.toHaveBeenCalled()
  })

  it('rejects invalid sync payload categories', async () => {
    const req = new NextRequest('http://localhost/api/receipts/receipt-1/sheets', {
      method: 'POST',
      body: JSON.stringify({ categories: { 'item-1': 'Pets' } }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await syncReceiptToSheets(req, { params: Promise.resolve({ id: 'receipt-1' }) })
    const body = await readJson(res)

    expect(res.status).toBe(400)
    expect(body.code).toBe('VALIDATION_ERROR')
  })

  it('rejects receipts that have no items to sync', async () => {
    mockedDb.receipt.findFirst.mockResolvedValueOnce(makeReceipt({ items: [] }))

    const req = new NextRequest('http://localhost/api/receipts/receipt-1/sheets', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await syncReceiptToSheets(req, { params: Promise.resolve({ id: 'receipt-1' }) })
    const body = await readJson(res)

    expect(res.status).toBe(422)
    expect(body.code).toBe('RECEIPT_ITEMS_MISSING')
  })

  it('returns the mapped expired-token error for pilot reconnect flow', async () => {
    mockedUploadReceiptToSheets.mockRejectedValueOnce(new Error('GOOGLE_AUTH_EXPIRED'))

    const req = new NextRequest('http://localhost/api/receipts/receipt-1/sheets', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await syncReceiptToSheets(req, { params: Promise.resolve({ id: 'receipt-1' }) })
    const body = await readJson(res)

    expect(res.status).toBe(401)
    expect(body.code).toBe('GOOGLE_AUTH_EXPIRED')
  })

  it('returns the mapped missing-scope error for missing Sheets permission', async () => {
    mockedUploadReceiptToSheets.mockRejectedValueOnce(new Error('SHEETS_SCOPE_MISSING'))

    const req = new NextRequest('http://localhost/api/receipts/receipt-1/sheets', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await syncReceiptToSheets(req, { params: Promise.resolve({ id: 'receipt-1' }) })
    const body = await readJson(res)

    expect(res.status).toBe(403)
    expect(body.code).toBe('SHEETS_SCOPE_MISSING')
  })

  it('rejects sync for receipts the signed-in user does not own', async () => {
    mockedDb.receipt.findFirst.mockResolvedValueOnce(null)

    const req = new NextRequest('http://localhost/api/receipts/other/sheets', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await syncReceiptToSheets(req, { params: Promise.resolve({ id: 'other' }) })
    const body = await readJson(res)

    expect(res.status).toBe(404)
    expect(body.code).toBe('RECEIPT_NOT_FOUND')
  })

  it('rejects unauthenticated sync attempts', async () => {
    mockedRequireAuth.mockRejectedValueOnce(new Error('Unauthorized'))

    const req = new NextRequest('http://localhost/api/receipts/receipt-1/sheets', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await syncReceiptToSheets(req, { params: Promise.resolve({ id: 'receipt-1' }) })
    const body = await readJson(res)

    expect(res.status).toBe(401)
    expect(body.code).toBe('UNAUTHORIZED')
  })

  it('requires human approval before syncing', async () => {
    mockedDb.receipt.findFirst.mockResolvedValueOnce(makeReceipt({ reviewStatus: 'needs_review' }))

    const req = new NextRequest('http://localhost/api/receipts/receipt-1/sheets', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await syncReceiptToSheets(req, { params: Promise.resolve({ id: 'receipt-1' }) })
    const body = await readJson(res)

    expect(res.status).toBe(409)
    expect(body.code).toBe('REVIEW_REQUIRED')
  })
})
