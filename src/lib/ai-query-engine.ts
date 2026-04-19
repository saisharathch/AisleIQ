/**
 * AI Query Engine — safe analytics layer for the AI Assistant.
 *
 * Flow:
 *   1. classifyIntent(question) — Claude classifies what the user is asking
 *   2. runAnalyticsQuery(userId, intent, params) — Prisma fetches real DB data
 *   3. formatAnswer(question, intent, data) — Claude writes a human answer
 *      based ONLY on the data returned; hallucination is structurally prevented.
 */

import Anthropic from '@anthropic-ai/sdk'
import { db } from './db'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = process.env.ANTHROPIC_OCR_MODEL ?? 'claude-haiku-4-5-20251001'

// ─── Intent types ──────────────────────────────────────────────────────────

export type Intent =
  | 'SPEND_THIS_MONTH'
  | 'SPEND_BY_CATEGORY'
  | 'SPEND_BY_STORE'
  | 'TOP_ITEMS'
  | 'AVG_RECEIPT'
  | 'MONTH_COMPARISON'
  | 'ROOMMATE_SPLIT'
  | 'BUDGET_STATUS'
  | 'TOP_RECURRING'
  | 'CHEAPEST_STORE_FOR_CATEGORY'
  | 'RECENT_RECEIPTS'
  | 'TOTAL_ALL_TIME'
  | 'UNSUPPORTED'

export interface IntentParams {
  month?: number | null       // 1-12
  year?: number | null        // YYYY
  month2?: number | null      // for comparison
  year2?: number | null
  category?: string | null
  store?: string | null
  person?: string | null
  limit?: number | null
}

export interface ClassifiedQuestion {
  intent: Intent
  params: IntentParams
}

// ─── Step 1: Classify intent ───────────────────────────────────────────────

const INTENT_DESCRIPTIONS = `
SPEND_THIS_MONTH: Total spending this month or a specific month ("how much did I spend in March", "total for April 2024")
SPEND_BY_CATEGORY: Spending broken down by category ("breakdown by category", "how much on dairy", "category spending")
SPEND_BY_STORE: Spending by store ("which store did I spend most at", "store breakdown", "Walmart vs Costco")
TOP_ITEMS: Most expensive or most-purchased items by total amount ("top items", "what did I buy most", "biggest expenses")
AVG_RECEIPT: Average receipt size / trip cost ("average grocery trip", "typical receipt amount")
MONTH_COMPARISON: Compare spending between two months ("did I spend more this month than last", "March vs April")
ROOMMATE_SPLIT: Who paid, roommate totals, split amounts ("who paid most", "Sam's contribution", "roommate spending")
BUDGET_STATUS: Budget vs actual spend ("am I over budget", "how much budget left", "budget status")
TOP_RECURRING: Items bought most frequently ("what do I buy regularly", "recurring items", "most common items")
CHEAPEST_STORE_FOR_CATEGORY: Which store is cheapest for a category/item ("cheapest dairy store", "where to buy produce cheap")
RECENT_RECEIPTS: Recent purchases ("what did I buy recently", "last few receipts", "latest purchases")
TOTAL_ALL_TIME: All-time total spending ("total ever spent", "lifetime spending", "how much in total")
UNSUPPORTED: Not related to grocery analytics or outside supported scope
`.trim()

export async function classifyIntent(question: string): Promise<ClassifiedQuestion> {
  const now = new Date()
  const cm  = now.getMonth() + 1
  const cy  = now.getFullYear()
  const pm  = cm === 1 ? 12 : cm - 1
  const py  = cm === 1 ? cy - 1 : cy

  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 300,
      system: `You are an intent classifier for a grocery expense analytics app. Today: ${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. Current month: ${cm}, year: ${cy}.

Classify the question into one intent and extract parameters. Return ONLY valid JSON — no markdown, no explanation.

Intents:
${INTENT_DESCRIPTIONS}

JSON format:
{
  "intent": "INTENT_NAME",
  "params": {
    "month": number|null (current month ${cm} when implied),
    "year": number|null (current year ${cy} when implied),
    "month2": number|null (for MONTH_COMPARISON: previous period; default prev month ${pm}),
    "year2": number|null (for MONTH_COMPARISON: year of second period; default ${py}),
    "category": string|null,
    "store": string|null,
    "person": string|null,
    "limit": number|null (default 10)
  }
}`,
      messages: [{ role: 'user', content: question }],
    })

    const raw = res.content[0].type === 'text' ? res.content[0].text.trim() : ''
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    const parsed = JSON.parse(jsonMatch[0]) as ClassifiedQuestion
    if (!parsed.intent) throw new Error('No intent')
    return parsed
  } catch {
    return { intent: 'UNSUPPORTED', params: {} }
  }
}

// ─── Step 2: Run analytics query ──────────────────────────────────────────

function monthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1)
  const end   = new Date(year, month, 0, 23, 59, 59, 999)
  return { gte: start, lte: end }
}

export async function runAnalyticsQuery(
  userId: string,
  intent: Intent,
  params: IntentParams,
): Promise<unknown> {
  const now   = new Date()
  const year  = params.year  ?? now.getFullYear()
  const month = params.month ?? now.getMonth() + 1
  const limit = params.limit ?? 10

  switch (intent) {

    // ── Total spend in a given month ───────────────────────────────────
    case 'SPEND_THIS_MONTH': {
      const receipts = await db.receipt.findMany({
        where: { userId, status: 'done', uploadDate: monthRange(year, month) },
        select: { grandTotal: true, storeName: true, purchaseDate: true },
      })
      const total = receipts.reduce((s, r) => s + (r.grandTotal ?? 0), 0)
      return {
        month, year,
        total: +total.toFixed(2),
        receiptCount: receipts.length,
        topStores: (() => {
          const m = new Map<string, number>()
          receipts.forEach((r) => {
            const k = r.storeName ?? 'Unknown'
            m.set(k, (m.get(k) ?? 0) + (r.grandTotal ?? 0))
          })
          return Array.from(m.entries())
            .map(([store, amt]) => ({ store, total: +amt.toFixed(2) }))
            .sort((a, b) => b.total - a.total).slice(0, 3)
        })(),
      }
    }

    // ── Spend by category ─────────────────────────────────────────────
    case 'SPEND_BY_CATEGORY': {
      const receipts = await db.receipt.findMany({
        where: { userId, status: 'done', uploadDate: monthRange(year, month) },
        include: { items: true },
      })
      const catMap = new Map<string, number>()
      receipts.forEach((r) => r.items.forEach((i) => {
        const k = i.category ?? 'Other'
        catMap.set(k, (catMap.get(k) ?? 0) + (i.lineTotal ?? 0))
      }))
      const categories = Array.from(catMap.entries())
        .map(([category, total]) => ({ category, total: +total.toFixed(2) }))
        .sort((a, b) => b.total - a.total)
      const grandTotal = categories.reduce((s, c) => s + c.total, 0)
      // If a specific category was mentioned, highlight it
      const highlighted = params.category
        ? categories.find((c) => c.category.toLowerCase().includes(params.category!.toLowerCase()))
        : null
      return { month, year, categories, grandTotal: +grandTotal.toFixed(2), highlighted }
    }

    // ── Spend by store ────────────────────────────────────────────────
    case 'SPEND_BY_STORE': {
      const receipts = await db.receipt.findMany({
        where: { userId, status: 'done', uploadDate: monthRange(year, month) },
        select: { storeName: true, grandTotal: true },
      })
      const storeMap = new Map<string, { total: number; count: number }>()
      receipts.forEach((r) => {
        const k = r.storeName ?? 'Unknown'
        const cur = storeMap.get(k) ?? { total: 0, count: 0 }
        storeMap.set(k, { total: cur.total + (r.grandTotal ?? 0), count: cur.count + 1 })
      })
      const stores = Array.from(storeMap.entries())
        .map(([store, { total, count }]) => ({ store, total: +total.toFixed(2), count }))
        .sort((a, b) => b.total - a.total)
      return { month, year, stores, receiptCount: receipts.length }
    }

    // ── Top items by total spend ──────────────────────────────────────
    case 'TOP_ITEMS': {
      const items = await db.receiptItem.findMany({
        where: { receipt: { userId, status: 'done' } },
        select: { item: true, lineTotal: true, category: true },
      })
      const itemMap = new Map<string, { total: number; count: number; category: string | null }>()
      items.forEach((i) => {
        const k = i.item.toLowerCase().trim()
        const cur = itemMap.get(k) ?? { total: 0, count: 0, category: i.category }
        itemMap.set(k, { total: cur.total + (i.lineTotal ?? 0), count: cur.count + 1, category: cur.category })
      })
      const topItems = Array.from(itemMap.entries())
        .map(([item, { total, count, category }]) => ({ item, total: +total.toFixed(2), count, category }))
        .sort((a, b) => b.total - a.total)
        .slice(0, limit)
      return { topItems, scope: 'all-time' }
    }

    // ── Average receipt value ─────────────────────────────────────────
    case 'AVG_RECEIPT': {
      const receipts = await db.receipt.findMany({
        where: { userId, status: 'done' },
        select: { grandTotal: true, uploadDate: true },
        orderBy: { uploadDate: 'desc' },
      })
      if (receipts.length === 0) return { avg: 0, min: 0, max: 0, count: 0 }
      const totals = receipts.map((r) => r.grandTotal ?? 0).filter((v) => v > 0)
      const avg = totals.reduce((s, v) => s + v, 0) / totals.length
      return {
        avg: +avg.toFixed(2),
        min: +Math.min(...totals).toFixed(2),
        max: +Math.max(...totals).toFixed(2),
        count: receipts.length,
        recentAvg: (() => {
          const recent = receipts.slice(0, 5).map((r) => r.grandTotal ?? 0).filter((v) => v > 0)
          if (!recent.length) return null
          return +(recent.reduce((s, v) => s + v, 0) / recent.length).toFixed(2)
        })(),
      }
    }

    // ── Month-over-month comparison ───────────────────────────────────
    case 'MONTH_COMPARISON': {
      const year2  = params.year2  ?? (month === 1 ? year - 1 : year)
      const month2 = params.month2 ?? (month === 1 ? 12 : month - 1)

      const [r1, r2] = await Promise.all([
        db.receipt.findMany({
          where: { userId, status: 'done', uploadDate: monthRange(year, month) },
          select: { grandTotal: true },
        }),
        db.receipt.findMany({
          where: { userId, status: 'done', uploadDate: monthRange(year2, month2) },
          select: { grandTotal: true },
        }),
      ])

      const t1 = r1.reduce((s, r) => s + (r.grandTotal ?? 0), 0)
      const t2 = r2.reduce((s, r) => s + (r.grandTotal ?? 0), 0)
      const delta    = t1 - t2
      const deltaPct = t2 === 0 ? null : (delta / t2) * 100

      return {
        period1: { month, year, total: +t1.toFixed(2), count: r1.length },
        period2: { month: month2, year: year2, total: +t2.toFixed(2), count: r2.length },
        delta: +delta.toFixed(2),
        deltaPct: deltaPct != null ? +deltaPct.toFixed(1) : null,
        spentMore: t1 > t2,
      }
    }

    // ── Roommate split ────────────────────────────────────────────────
    case 'ROOMMATE_SPLIT': {
      const receipts = await db.receipt.findMany({
        where: { userId, status: 'done' },
        select: { paidBy: true, splitWith: true, grandTotal: true, storeName: true, purchaseDate: true, uploadDate: true },
        orderBy: { uploadDate: 'desc' },
        take: 100,
      })

      const paidMap  = new Map<string, { total: number; count: number }>()
      const splitMap = new Map<string, number>()

      for (const r of receipts) {
        if (!r.paidBy && !r.splitWith) continue
        const payer  = r.paidBy ?? 'Unknown'
        const total  = r.grandTotal ?? 0
        const cur    = paidMap.get(payer) ?? { total: 0, count: 0 }
        paidMap.set(payer, { total: cur.total + total, count: cur.count + 1 })

        let partners: string[] = []
        try { partners = JSON.parse(r.splitWith ?? '[]') } catch { /* */ }
        if (partners.length > 0) {
          const share = total / (partners.length + 1)
          partners.forEach((p) => splitMap.set(p, (splitMap.get(p) ?? 0) + share))
        }
      }

      const payerTotals = Array.from(paidMap.entries())
        .map(([person, { total, count }]) => ({ person, totalPaid: +total.toFixed(2), count }))
        .sort((a, b) => b.totalPaid - a.totalPaid)

      const splitTotals = Array.from(splitMap.entries())
        .map(([person, owes]) => ({ person, owes: +owes.toFixed(2) }))
        .sort((a, b) => b.owes - a.owes)

      // Filter to mentioned person if any
      const focus = params.person?.toLowerCase()
      return {
        payerTotals: focus
          ? payerTotals.filter((p) => p.person.toLowerCase().includes(focus))
          : payerTotals,
        splitTotals: focus
          ? splitTotals.filter((p) => p.person.toLowerCase().includes(focus))
          : splitTotals,
        totalTracked: receipts.filter((r) => r.paidBy || r.splitWith).length,
        hasData: payerTotals.length > 0,
      }
    }

    // ── Budget status ─────────────────────────────────────────────────
    case 'BUDGET_STATUS': {
      const [budgets, receipts] = await Promise.all([
        db.budget.findMany({
          where: { userId, year, month },
        }),
        db.receipt.findMany({
          where: { userId, status: 'done', uploadDate: monthRange(year, month) },
          include: { items: true },
        }),
      ])

      if (budgets.length === 0) return { hasBudgets: false, month, year }

      const catSpend = new Map<string, number>()
      let totalSpend = 0
      receipts.forEach((r) => {
        totalSpend += r.grandTotal ?? 0
        r.items.forEach((i) => {
          const k = i.category ?? 'Other'
          catSpend.set(k, (catSpend.get(k) ?? 0) + (i.lineTotal ?? 0))
        })
      })

      const budgetRows = budgets.map((b) => {
        const spent = b.category ? (catSpend.get(b.category) ?? 0) : totalSpend
        const pct   = b.amount > 0 ? (spent / b.amount) * 100 : 0
        return {
          label:     b.category ?? 'Overall',
          budget:    b.amount,
          spent:     +spent.toFixed(2),
          remaining: +(b.amount - spent).toFixed(2),
          pct:       +pct.toFixed(1),
          over:      spent > b.amount,
        }
      }).sort((a, b) => b.pct - a.pct)

      return { hasBudgets: true, month, year, budgetRows, totalSpend: +totalSpend.toFixed(2) }
    }

    // ── Top recurring items (by purchase frequency) ───────────────────
    case 'TOP_RECURRING': {
      const items = await db.receiptItem.findMany({
        where: { receipt: { userId, status: 'done' } },
        select: { item: true, lineTotal: true, unitPrice: true },
      })
      const freqMap = new Map<string, { count: number; totalSpent: number; prices: number[] }>()
      items.forEach((i) => {
        const k = i.item.toLowerCase().trim()
        const cur = freqMap.get(k) ?? { count: 0, totalSpent: 0, prices: [] }
        freqMap.set(k, {
          count:      cur.count + 1,
          totalSpent: cur.totalSpent + (i.lineTotal ?? 0),
          prices:     i.unitPrice ? [...cur.prices, i.unitPrice] : cur.prices,
        })
      })
      const recurring = Array.from(freqMap.entries())
        .filter(([, v]) => v.count >= 2)
        .map(([item, { count, totalSpent, prices }]) => ({
          item,
          count,
          totalSpent:  +totalSpent.toFixed(2),
          avgUnitPrice: prices.length
            ? +(prices.reduce((s, v) => s + v, 0) / prices.length).toFixed(2)
            : null,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit)
      return { recurring, scope: 'all-time' }
    }

    // ── Cheapest store for a category ─────────────────────────────────
    case 'CHEAPEST_STORE_FOR_CATEGORY': {
      const targetCat = params.category ?? params.store ?? ''
      const items = await db.receiptItem.findMany({
        where: {
          receipt: { userId, status: 'done' },
          ...(targetCat ? { category: { contains: targetCat } } : {}),
        },
        include: { receipt: { select: { storeName: true } } },
      })
      const storeMap = new Map<string, { total: number; count: number }>()
      items.forEach((i) => {
        const k   = i.receipt.storeName ?? 'Unknown'
        const cur = storeMap.get(k) ?? { total: 0, count: 0 }
        storeMap.set(k, { total: cur.total + (i.lineTotal ?? 0), count: cur.count + 1 })
      })
      const stores = Array.from(storeMap.entries())
        .map(([store, { total, count }]) => ({
          store,
          avgItemCost: count > 0 ? +(total / count).toFixed(2) : 0,
          totalSpent:  +total.toFixed(2),
          itemCount:   count,
        }))
        .filter((s) => s.itemCount >= 2)
        .sort((a, b) => a.avgItemCost - b.avgItemCost)
      return { category: targetCat || 'all', stores, hasData: stores.length > 0 }
    }

    // ── Recent receipts ───────────────────────────────────────────────
    case 'RECENT_RECEIPTS': {
      const receipts = await db.receipt.findMany({
        where: { userId, status: 'done' },
        orderBy: { uploadDate: 'desc' },
        take: Math.min(limit, 10),
        select: {
          storeName: true, grandTotal: true, purchaseDate: true,
          uploadDate: true, reviewStatus: true,
          _count: { select: { items: true } },
        },
      })
      return {
        receipts: receipts.map((r) => ({
          store:    r.storeName ?? 'Unknown',
          total:    r.grandTotal != null ? +r.grandTotal.toFixed(2) : null,
          date:     (r.purchaseDate ?? r.uploadDate).toISOString().slice(0, 10),
          items:    r._count.items,
          approved: r.reviewStatus === 'approved',
        })),
        count: receipts.length,
      }
    }

    // ── All-time total ─────────────────────────────────────────────────
    case 'TOTAL_ALL_TIME': {
      const receipts = await db.receipt.findMany({
        where: { userId, status: 'done' },
        select: { grandTotal: true, uploadDate: true },
        orderBy: { uploadDate: 'asc' },
      })
      const total = receipts.reduce((s, r) => s + (r.grandTotal ?? 0), 0)
      return {
        total: +total.toFixed(2),
        receiptCount: receipts.length,
        firstReceipt: receipts[0]?.uploadDate.toISOString().slice(0, 10) ?? null,
        lastReceipt:  receipts.at(-1)?.uploadDate.toISOString().slice(0, 10) ?? null,
        avg:          receipts.length ? +(total / receipts.length).toFixed(2) : 0,
      }
    }

    case 'UNSUPPORTED':
    default:
      return null
  }
}

// ─── Step 3: Format the answer ─────────────────────────────────────────────

const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

export async function formatAnswer(
  question: string,
  intent: Intent,
  params: IntentParams,
  data: unknown,
): Promise<string> {
  if (intent === 'UNSUPPORTED') {
    return "I can only answer questions about your grocery spending — things like monthly totals, category breakdowns, store comparisons, recurring items, budget status, and roommate splits. Try one of the suggested prompts!"
  }

  const monthLabel = params.month ? `${MONTH_NAMES[params.month]} ${params.year ?? ''}`.trim() : 'this period'

  const contextNote = `Intent: ${intent}. Period: ${monthLabel}.`

  try {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      system: `You are a helpful grocery expense assistant. Answer the user's question based ONLY on the data provided below. Be concise, specific, and friendly.

Rules:
- Use ONLY the numbers and facts in the provided data. Do not add, estimate, or infer anything not in the data.
- If the data is empty or has zero receipts, say clearly that there is not enough data for that period.
- Format currency as $X.XX. Highlight key numbers.
- Keep the answer under 150 words.
- Do not mention "the data", "the query", or "the database" — speak naturally as if you know the user's spending.
- Do not add disclaimers or caveats not supported by the data.
- ${contextNote}`,
      messages: [
        {
          role: 'user',
          content: `User question: "${question}"\n\nData:\n${JSON.stringify(data, null, 2)}`,
        },
      ],
    })
    return res.content[0].type === 'text' ? res.content[0].text.trim() : 'Unable to format response.'
  } catch {
    // Fallback: generate a basic response without Claude
    return generateFallbackAnswer(intent, params, data)
  }
}

function generateFallbackAnswer(intent: Intent, params: IntentParams, data: unknown): string {
  const d = data as Record<string, unknown>
  const m = params.month ? MONTH_NAMES[params.month] : 'This period'

  switch (intent) {
    case 'SPEND_THIS_MONTH':
      return d.receiptCount === 0
        ? `No receipts found for ${m}.`
        : `You spent **$${d.total}** across ${d.receiptCount} receipt(s) in ${m}.`
    case 'SPEND_BY_CATEGORY': {
      const cats = d.categories as { category: string; total: number }[] | undefined
      if (!cats?.length) return `No category data found for ${m}.`
      const top = cats[0]
      return `Top category in ${m}: **${top.category}** at $${top.total}. Total: $${d.grandTotal}.`
    }
    case 'TOTAL_ALL_TIME':
      return `All-time total: **$${d.total}** across ${d.receiptCount} receipts.`
    default:
      return JSON.stringify(data, null, 2)
  }
}
