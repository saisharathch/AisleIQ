import type { ReceiptItem } from '@prisma/client'
import type { ReceiptWithItems } from '@/types'
import { formatCurrency } from './calculations'

export function toCSV(receipt: ReceiptWithItems): string {
  const rows = [
    ['Store', 'Item', 'Quantity', 'Unit Price', 'Line Total', 'Tax', 'Needs Review'],
  ]

  for (const item of receipt.items) {
    rows.push([
      receipt.storeName ?? '',
      item.item,
      item.quantity?.toString() ?? '',
      item.unitPrice?.toFixed(2) ?? '',
      item.lineTotal?.toFixed(2) ?? '',
      item.tax?.toFixed(2) ?? '',
      item.needsReview ? 'Yes' : 'No',
    ])
  }

  // Summary rows
  rows.push([])
  rows.push(['', '', '', 'Subtotal', receipt.subtotal?.toFixed(2) ?? '', '', ''])
  rows.push(['', '', '', 'Total Tax', receipt.totalTax?.toFixed(2) ?? '', '', ''])
  if (receipt.discount) {
    rows.push(['', '', '', 'Discount', `-${receipt.discount.toFixed(2)}`, '', ''])
  }
  rows.push(['', '', '', 'Grand Total', receipt.grandTotal?.toFixed(2) ?? '', '', ''])

  return rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
}

export function buildPdfData(receipt: ReceiptWithItems) {
  return {
    title: `Receipt — ${receipt.storeName ?? 'Unknown Store'}`,
    date: receipt.uploadDate.toLocaleDateString(),
    columns: ['Store', 'Item', 'Qty', 'Unit Price', 'Line Total', 'Tax'],
    rows: receipt.items.map((item) => [
      receipt.storeName ?? '',
      item.item,
      item.quantity?.toString() ?? '—',
      formatCurrency(item.unitPrice),
      formatCurrency(item.lineTotal),
      formatCurrency(item.tax),
    ]),
    subtotal: formatCurrency(receipt.subtotal),
    totalTax: formatCurrency(receipt.totalTax),
    discount: receipt.discount ? formatCurrency(receipt.discount) : null,
    grandTotal: formatCurrency(receipt.grandTotal),
  }
}
