export interface RawItem {
  item: string
  category: string | null
  unitPrice: number | null
  lineTotal: number | null
  quantity: number | null
  receipt: { uploadDate: Date; storeName: string | null }
}

export interface ShoppingSuggestion {
  name: string
  category: string | null
  avgPrice: number | null
  count: number
  lastBought: string
  topStore: string | null
}

export function buildShoppingSuggestions(items: RawItem[], limit = 50): ShoppingSuggestion[] {
  const map = new Map<string, {
    name: string
    category: string | null
    prices: number[]
    stores: string[]
    dates: Date[]
    count: number
  }>()

  for (const i of items) {
    const key = i.item.trim().toLowerCase()
    const existing = map.get(key)
    const price = i.unitPrice ?? (i.lineTotal && i.quantity ? i.lineTotal / i.quantity : i.lineTotal)

    if (existing) {
      existing.count++
      if (price != null) existing.prices.push(price)
      if (i.receipt.storeName) existing.stores.push(i.receipt.storeName)
      existing.dates.push(i.receipt.uploadDate)
    } else {
      map.set(key, {
        name: i.item.trim(),
        category: i.category,
        prices: price != null ? [price] : [],
        stores: i.receipt.storeName ? [i.receipt.storeName] : [],
        dates: [i.receipt.uploadDate],
        count: 1,
      })
    }
  }

  return Array.from(map.values())
    .filter((v) => v.count >= 2)
    .map((v) => {
      const avgPrice = v.prices.length > 0
        ? v.prices.reduce((a, b) => a + b, 0) / v.prices.length
        : null
      const lastBought = new Date(Math.max(...v.dates.map((d) => d.getTime())))

      let topStore: string | null = null
      if (v.stores.length > 0) {
        const freq = new Map<string, number>()
        for (const s of v.stores) freq.set(s, (freq.get(s) ?? 0) + 1)
        let best = 0
        for (const [s, n] of freq) { if (n > best) { best = n; topStore = s } }
      }

      return {
        name: v.name,
        category: v.category,
        avgPrice: avgPrice != null ? +avgPrice.toFixed(2) : null,
        count: v.count,
        lastBought: lastBought.toISOString(),
        topStore,
      }
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export function buildPriceHistoryMap(
  items: Array<{ item: string; unitPrice: number | null }>,
): Record<string, { avg: number; count: number }> {
  const priceMap: Record<string, number[]> = {}
  for (const pi of items) {
    if (pi.unitPrice == null) continue
    const key = pi.item.trim().toLowerCase()
    if (!priceMap[key]) priceMap[key] = []
    priceMap[key].push(pi.unitPrice)
  }

  const result: Record<string, { avg: number; count: number }> = {}
  for (const [key, prices] of Object.entries(priceMap)) {
    const avg = prices.reduce((a, b) => a + b, 0) / prices.length
    result[key] = { avg: +avg.toFixed(4), count: prices.length }
  }
  return result
}

export function computeBudgetAlerts(
  budgets: Array<{ year: number; month: number; category: string | null; amount: number }>,
  categoryActuals: Array<{ category: string; spent: number }>,
  totalSpend: number,
  year: number,
  month: number,
  threshold = 80,
): Array<{ label: string; spent: number; budget: number; percent: number }> {
  const alerts: Array<{ label: string; spent: number; budget: number; percent: number }> = []

  const overallBudget = budgets.find((b) => b.year === year && b.month === month && !b.category)
  if (overallBudget && overallBudget.amount > 0 && totalSpend > 0) {
    const pct = (totalSpend / overallBudget.amount) * 100
    if (pct >= threshold) {
      alerts.push({ label: 'Overall Monthly Budget', spent: totalSpend, budget: overallBudget.amount, percent: pct })
    }
  }

  for (const budget of budgets.filter((b) => b.year === year && b.month === month && b.category)) {
    if (budget.amount <= 0) continue
    const actual = categoryActuals.find((c) => c.category === budget.category)
    if (actual && actual.spent > 0) {
      const pct = (actual.spent / budget.amount) * 100
      if (pct >= threshold) {
        alerts.push({ label: budget.category!, spent: actual.spent, budget: budget.amount, percent: pct })
      }
    }
  }

  return alerts
}
