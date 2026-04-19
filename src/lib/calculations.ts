import type { ReceiptItem } from '@prisma/client'
import type { ReceiptTotals, ValidationIssue } from '@/types'

export function calcTotals(items: ReceiptItem[]): ReceiptTotals {
  let subtotal = 0
  let totalTax = 0
  let flaggedCount = 0
  let confidenceTotal = 0

  for (const item of items) {
    subtotal += item.lineTotal ?? inferLineTotal(item) ?? 0
    totalTax += item.tax ?? 0
    if (item.needsReview) flaggedCount++
    confidenceTotal += item.confidence ?? 0
  }

  return {
    subtotal: round2(subtotal),
    totalTax: round2(totalTax),
    discount: 0,
    grandTotal: round2(subtotal + totalTax),
    itemCount: items.length,
    flaggedCount,
    avgConfidence: items.length ? round2(confidenceTotal / items.length) : 0,
  }
}

export function inferLineTotal(item: Partial<ReceiptItem>): number | null {
  if (item.quantity != null && item.unitPrice != null) {
    return round2(item.quantity * item.unitPrice)
  }
  return null
}

export function inferUnitPrice(item: Partial<ReceiptItem>): number | null {
  if (item.lineTotal != null && item.quantity != null && item.quantity !== 0) {
    return round2(item.lineTotal / item.quantity)
  }
  return null
}

export function inferQuantity(item: Partial<ReceiptItem>): number | null {
  if (item.lineTotal != null && item.unitPrice != null && item.unitPrice !== 0) {
    return round2(item.lineTotal / item.unitPrice)
  }
  return null
}

export function validateItems(items: ReceiptItem[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  for (const item of items) {
    const computedLineTotal = inferLineTotal(item)
    if (
      computedLineTotal !== null &&
      item.lineTotal !== null &&
      Math.abs(computedLineTotal - (item.lineTotal ?? 0)) > 0.02
    ) {
      issues.push({
        itemId: item.id,
        field: 'lineTotal',
        message: `Math mismatch: ${item.quantity} × ${item.unitPrice} = ${computedLineTotal}, but recorded as ${item.lineTotal}`,
        severity: 'error',
      })
    }

    if (item.lineTotal === null && item.quantity === null && item.unitPrice === null) {
      issues.push({
        itemId: item.id,
        field: 'item',
        message: 'No pricing data available — needs manual entry',
        severity: 'warning',
      })
    }
  }

  return issues
}

export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}
