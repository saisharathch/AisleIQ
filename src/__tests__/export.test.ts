import { toCSV } from '@/lib/export'
import type { Receipt, ReceiptItem } from '@prisma/client'

function makeReceipt(items: Partial<ReceiptItem>[] = []): Receipt & { items: ReceiptItem[] } {
  const base: Receipt = {
    id: 'r1',
    userId: 'u1',
    storeName: 'Walmart',
    purchaseDate: new Date('2024-01-01'),
    fileUrl: '/uploads/test.jpg',
    fileType: 'image/jpeg',
    fileName: 'test.jpg',
    fileSize: 1000,
    status: 'done',
    overallConfidence: 0.95,
    reviewStatus: 'approved',
    reviewedAt: new Date('2024-01-01'),
    errorMessage: null,
    ocrRawText: null,
    subtotal: 10,
    totalTax: 1,
    discount: null,
    grandTotal: 11,
    syncStatus: 'synced',
    syncErrorMessage: null,
    syncAttempts: 1,
    lastSyncHash: 'hash',
    duplicateOfReceiptId: null,
    duplicateScore: null,
    duplicateReason: null,
    duplicateOverride: false,
    notes: null,
    paidBy: null,
    splitWith: null,
    fileHash: null,
    sheetsUploadId: null,
    sheetsSyncedAt: null,
    uploadDate: new Date('2024-01-01'),
    processedAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  }
  const baseItem: ReceiptItem = {
    id: 'i1',
    receiptId: 'r1',
    store: 'Walmart',
    item: 'Milk',
    category: 'Dairy',
    quantity: 1,
    unitPrice: 3.99,
    lineTotal: 3.99,
    tax: 0,
    confidence: 1,
    needsReview: false,
    sourceText: null,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  return { ...base, items: items.map((i, idx) => ({ ...baseItem, id: `i${idx}`, ...i })) }
}

describe('toCSV', () => {
  it('generates header row', () => {
    const csv = toCSV(makeReceipt())
    expect(csv).toContain('Store')
    expect(csv).toContain('Item')
    expect(csv).toContain('Quantity')
    expect(csv).toContain('Unit Price')
    expect(csv).toContain('Line Total')
    expect(csv).toContain('Tax')
  })

  it('includes item data', () => {
    const csv = toCSV(makeReceipt([{ item: 'Bananas', quantity: 1.5, unitPrice: 0.58 }]))
    expect(csv).toContain('Bananas')
    expect(csv).toContain('Walmart')
  })

  it('includes summary rows', () => {
    const csv = toCSV(makeReceipt())
    expect(csv).toContain('Subtotal')
    expect(csv).toContain('Grand Total')
  })

  it('escapes quotes in item names', () => {
    const csv = toCSV(makeReceipt([{ item: 'She said "hello"' }]))
    expect(csv).toContain('She said ""hello""')
  })
})
