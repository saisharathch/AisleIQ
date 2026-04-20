import {
  buildShoppingSuggestions,
  buildPriceHistoryMap,
  computeBudgetAlerts,
  type RawItem,
} from '@/lib/shopping-list'

function makeItem(overrides: Partial<RawItem> = {}): RawItem {
  return {
    item: 'Milk',
    category: 'Dairy',
    unitPrice: 3.99,
    lineTotal: 3.99,
    quantity: 1,
    receipt: { uploadDate: new Date('2026-03-01'), storeName: 'Walmart' },
    ...overrides,
  }
}

// ─── buildShoppingSuggestions ─────────────────────────────────────────────────

describe('buildShoppingSuggestions', () => {
  it('returns only items purchased ≥2 times', () => {
    const items: RawItem[] = [
      makeItem({ item: 'Milk' }),
      makeItem({ item: 'Milk', receipt: { uploadDate: new Date('2026-03-15'), storeName: 'Walmart' } }),
      makeItem({ item: 'Bread' }),
    ]
    const result = buildShoppingSuggestions(items)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Milk')
    expect(result[0].count).toBe(2)
  })

  it('normalizes item names case-insensitively', () => {
    const items: RawItem[] = [
      makeItem({ item: 'MILK' }),
      makeItem({ item: 'milk' }),
      makeItem({ item: 'Milk' }),
    ]
    const result = buildShoppingSuggestions(items)
    expect(result).toHaveLength(1)
    expect(result[0].count).toBe(3)
    expect(result[0].name).toBe('MILK') // preserves first-seen casing
  })

  it('trims whitespace from item names', () => {
    const items: RawItem[] = [
      makeItem({ item: '  Eggs  ' }),
      makeItem({ item: 'Eggs' }),
    ]
    const result = buildShoppingSuggestions(items)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Eggs')
  })

  it('calculates average price correctly', () => {
    const items: RawItem[] = [
      makeItem({ item: 'Milk', unitPrice: 3.00 }),
      makeItem({ item: 'Milk', unitPrice: 4.00 }),
    ]
    const result = buildShoppingSuggestions(items)
    expect(result[0].avgPrice).toBe(3.50)
  })

  it('returns null avgPrice when no prices available', () => {
    const items: RawItem[] = [
      makeItem({ item: 'Milk', unitPrice: null, lineTotal: null, quantity: null }),
      makeItem({ item: 'Milk', unitPrice: null, lineTotal: null, quantity: null }),
    ]
    const result = buildShoppingSuggestions(items)
    expect(result[0].avgPrice).toBeNull()
  })

  it('infers price from lineTotal and quantity when unitPrice missing', () => {
    const items: RawItem[] = [
      makeItem({ item: 'Milk', unitPrice: null, lineTotal: 6.00, quantity: 2 }),
      makeItem({ item: 'Milk', unitPrice: null, lineTotal: 6.00, quantity: 2 }),
    ]
    const result = buildShoppingSuggestions(items)
    expect(result[0].avgPrice).toBe(3.00)
  })

  it('picks the most frequent store as topStore', () => {
    const items: RawItem[] = [
      makeItem({ item: 'Milk', receipt: { uploadDate: new Date(), storeName: 'Walmart' } }),
      makeItem({ item: 'Milk', receipt: { uploadDate: new Date(), storeName: 'Costco' } }),
      makeItem({ item: 'Milk', receipt: { uploadDate: new Date(), storeName: 'Walmart' } }),
    ]
    const result = buildShoppingSuggestions(items)
    expect(result[0].topStore).toBe('Walmart')
  })

  it('returns topStore null when no store data', () => {
    const items: RawItem[] = [
      makeItem({ item: 'Milk', receipt: { uploadDate: new Date(), storeName: null } }),
      makeItem({ item: 'Milk', receipt: { uploadDate: new Date(), storeName: null } }),
    ]
    const result = buildShoppingSuggestions(items)
    expect(result[0].topStore).toBeNull()
  })

  it('sorts results by count descending', () => {
    const base = new Date('2026-03-01')
    const items: RawItem[] = [
      makeItem({ item: 'Bread' }),
      makeItem({ item: 'Bread' }),
      makeItem({ item: 'Milk' }),
      makeItem({ item: 'Milk' }),
      makeItem({ item: 'Milk' }),
      makeItem({ item: 'Eggs' }),
      makeItem({ item: 'Eggs' }),
      makeItem({ item: 'Eggs' }),
      makeItem({ item: 'Eggs' }),
    ]
    void base
    const result = buildShoppingSuggestions(items)
    expect(result[0].name).toBe('Eggs')
    expect(result[1].name).toBe('Milk')
    expect(result[2].name).toBe('Bread')
  })

  it('respects the limit parameter', () => {
    const items: RawItem[] = []
    for (let i = 0; i < 10; i++) {
      items.push(makeItem({ item: `Item ${i}` }))
      items.push(makeItem({ item: `Item ${i}` }))
    }
    const result = buildShoppingSuggestions(items, 3)
    expect(result).toHaveLength(3)
  })

  it('returns lastBought as ISO string of the most recent purchase date', () => {
    const older = new Date('2026-01-01')
    const newer = new Date('2026-03-15')
    const items: RawItem[] = [
      makeItem({ item: 'Milk', receipt: { uploadDate: older, storeName: 'Walmart' } }),
      makeItem({ item: 'Milk', receipt: { uploadDate: newer, storeName: 'Walmart' } }),
    ]
    const result = buildShoppingSuggestions(items)
    expect(result[0].lastBought).toBe(newer.toISOString())
  })

  it('returns empty array when no items', () => {
    expect(buildShoppingSuggestions([])).toEqual([])
  })
})

// ─── buildPriceHistoryMap ─────────────────────────────────────────────────────

describe('buildPriceHistoryMap', () => {
  it('calculates average price per item', () => {
    const items = [
      { item: 'Milk', unitPrice: 3.00 },
      { item: 'Milk', unitPrice: 5.00 },
    ]
    const result = buildPriceHistoryMap(items)
    expect(result['milk']).toEqual({ avg: 4.0, count: 2 })
  })

  it('normalizes item names to lowercase keys', () => {
    const items = [
      { item: 'MILK', unitPrice: 3.00 },
      { item: 'Milk', unitPrice: 5.00 },
    ]
    const result = buildPriceHistoryMap(items)
    expect(result['milk']).toBeDefined()
    expect(result['MILK']).toBeUndefined()
  })

  it('excludes items with null unitPrice', () => {
    const items = [
      { item: 'Milk', unitPrice: null },
      { item: 'Bread', unitPrice: 2.50 },
      { item: 'Bread', unitPrice: 3.00 },
    ]
    const result = buildPriceHistoryMap(items)
    expect(result['milk']).toBeUndefined()
    expect(result['bread']).toEqual({ avg: 2.75, count: 2 })
  })

  it('returns empty map for empty input', () => {
    expect(buildPriceHistoryMap([])).toEqual({})
  })

  it('handles single-item history', () => {
    const result = buildPriceHistoryMap([{ item: 'Eggs', unitPrice: 4.99 }])
    expect(result['eggs']).toEqual({ avg: 4.99, count: 1 })
  })

  it('trims whitespace from item names', () => {
    const items = [
      { item: '  Milk  ', unitPrice: 3.00 },
      { item: 'Milk', unitPrice: 5.00 },
    ]
    const result = buildPriceHistoryMap(items)
    expect(result['milk']).toEqual({ avg: 4.0, count: 2 })
  })
})

// ─── computeBudgetAlerts ──────────────────────────────────────────────────────

const YEAR = 2026
const MONTH = 4

function makeBudget(category: string | null, amount: number, year = YEAR, month = MONTH) {
  return { year, month, category, amount }
}

describe('computeBudgetAlerts', () => {
  it('flags category over 80% as alert', () => {
    const budgets = [makeBudget('Dairy', 100)]
    const actuals = [{ category: 'Dairy', spent: 85 }]
    const alerts = computeBudgetAlerts(budgets, actuals, 0, YEAR, MONTH)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].label).toBe('Dairy')
    expect(alerts[0].percent).toBeCloseTo(85)
  })

  it('does not flag categories under threshold', () => {
    const budgets = [makeBudget('Dairy', 100)]
    const actuals = [{ category: 'Dairy', spent: 79 }]
    const alerts = computeBudgetAlerts(budgets, actuals, 0, YEAR, MONTH)
    expect(alerts).toHaveLength(0)
  })

  it('flags the overall budget when over threshold', () => {
    const budgets = [makeBudget(null, 500)]
    const alerts = computeBudgetAlerts(budgets, [], 450, YEAR, MONTH)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].label).toBe('Overall Monthly Budget')
  })

  it('ignores zero-amount budgets', () => {
    const budgets = [makeBudget('Dairy', 0)]
    const actuals = [{ category: 'Dairy', spent: 50 }]
    const alerts = computeBudgetAlerts(budgets, actuals, 0, YEAR, MONTH)
    expect(alerts).toHaveLength(0)
  })

  it('ignores negative-amount budgets', () => {
    const budgets = [makeBudget('Dairy', -100)]
    const actuals = [{ category: 'Dairy', spent: 50 }]
    const alerts = computeBudgetAlerts(budgets, actuals, 0, YEAR, MONTH)
    expect(alerts).toHaveLength(0)
  })

  it('ignores budgets for different months', () => {
    const budgets = [makeBudget('Dairy', 100, YEAR, MONTH - 1)]
    const actuals = [{ category: 'Dairy', spent: 99 }]
    const alerts = computeBudgetAlerts(budgets, actuals, 0, YEAR, MONTH)
    expect(alerts).toHaveLength(0)
  })

  it('ignores category with zero spend', () => {
    const budgets = [makeBudget('Dairy', 100)]
    const actuals = [{ category: 'Dairy', spent: 0 }]
    const alerts = computeBudgetAlerts(budgets, actuals, 0, YEAR, MONTH)
    expect(alerts).toHaveLength(0)
  })

  it('does not flag overall budget when totalSpend is 0', () => {
    const budgets = [makeBudget(null, 500)]
    const alerts = computeBudgetAlerts(budgets, [], 0, YEAR, MONTH)
    expect(alerts).toHaveLength(0)
  })

  it('flags exactly-at-100% as over budget', () => {
    const budgets = [makeBudget('Meat & Seafood', 50)]
    const actuals = [{ category: 'Meat & Seafood', spent: 50 }]
    const alerts = computeBudgetAlerts(budgets, actuals, 0, YEAR, MONTH)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].percent).toBe(100)
  })

  it('respects custom threshold', () => {
    const budgets = [makeBudget('Dairy', 100)]
    const actuals = [{ category: 'Dairy', spent: 65 }]
    const noAlert = computeBudgetAlerts(budgets, actuals, 0, YEAR, MONTH, 80)
    expect(noAlert).toHaveLength(0)
    const withAlert = computeBudgetAlerts(budgets, actuals, 0, YEAR, MONTH, 60)
    expect(withAlert).toHaveLength(1)
  })

  it('returns empty array when no budgets set', () => {
    const alerts = computeBudgetAlerts([], [{ category: 'Dairy', spent: 100 }], 100, YEAR, MONTH)
    expect(alerts).toHaveLength(0)
  })
})
