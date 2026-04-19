import {
  calcTotals,
  inferLineTotal,
  inferUnitPrice,
  inferQuantity,
  validateItems,
  formatCurrency,
  round2,
} from '@/lib/calculations'
import type { ReceiptItem } from '@prisma/client'

function makeItem(overrides: Partial<ReceiptItem> = {}): ReceiptItem {
  return {
    id: 'test-id',
    receiptId: 'r1',
    store: 'Walmart',
    item: 'Test Item',
    category: 'Other',
    quantity: 1,
    unitPrice: 2.99,
    lineTotal: 2.99,
    tax: 0,
    confidence: 1.0,
    needsReview: false,
    sourceText: null,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

describe('round2', () => {
  it('rounds to 2 decimal places', () => {
    expect(round2(1.005)).toBe(1.01)
    expect(round2(2.999)).toBe(3)
    expect(round2(1.234)).toBe(1.23)
  })
})

describe('formatCurrency', () => {
  it('formats numbers as USD', () => {
    expect(formatCurrency(12.5)).toBe('$12.50')
    expect(formatCurrency(0)).toBe('$0.00')
  })
  it('returns em-dash for null', () => {
    expect(formatCurrency(null)).toBe('—')
    expect(formatCurrency(undefined)).toBe('—')
  })
})

describe('inferLineTotal', () => {
  it('calculates qty × unit price', () => {
    expect(inferLineTotal({ quantity: 3, unitPrice: 2.5 })).toBe(7.5)
  })
  it('handles decimal qty', () => {
    expect(inferLineTotal({ quantity: 1.52, unitPrice: 0.58 })).toBe(0.88)
  })
  it('returns null when missing inputs', () => {
    expect(inferLineTotal({ quantity: null, unitPrice: 2.99 })).toBeNull()
    expect(inferLineTotal({ quantity: 1, unitPrice: null })).toBeNull()
  })
})

describe('inferUnitPrice', () => {
  it('calculates lineTotal / quantity', () => {
    expect(inferUnitPrice({ lineTotal: 7.5, quantity: 3 })).toBe(2.5)
  })
  it('returns null when quantity is zero', () => {
    expect(inferUnitPrice({ lineTotal: 5, quantity: 0 })).toBeNull()
  })
})

describe('inferQuantity', () => {
  it('calculates lineTotal / unitPrice', () => {
    expect(inferQuantity({ lineTotal: 9, unitPrice: 3 })).toBe(3)
  })
})

describe('calcTotals', () => {
  it('sums line totals and tax', () => {
    const items = [
      makeItem({ lineTotal: 5, tax: 0.5 }),
      makeItem({ lineTotal: 3, tax: 0.3 }),
    ]
    const totals = calcTotals(items)
    expect(totals.subtotal).toBe(8)
    expect(totals.totalTax).toBe(0.8)
    expect(totals.grandTotal).toBe(8.8)
  })

  it('counts flagged items', () => {
    const items = [makeItem({ needsReview: true }), makeItem({ needsReview: false })]
    expect(calcTotals(items).flaggedCount).toBe(1)
  })
})

describe('validateItems', () => {
  it('flags math mismatches', () => {
    const items = [makeItem({ quantity: 2, unitPrice: 3, lineTotal: 10 })]
    const issues = validateItems(items)
    expect(issues.length).toBeGreaterThan(0)
    expect(issues[0].severity).toBe('error')
  })

  it('returns no issues for valid items', () => {
    const items = [makeItem({ quantity: 2, unitPrice: 3, lineTotal: 6 })]
    expect(validateItems(items)).toHaveLength(0)
  })
})
