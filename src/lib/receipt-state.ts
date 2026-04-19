import type { Receipt, ReceiptItem } from '@prisma/client'
import type { ReviewStatus, SyncStatus } from '@/types'

export function buildReceiptSyncHash(
  receipt: Pick<Receipt, 'storeName' | 'purchaseDate' | 'subtotal' | 'totalTax' | 'discount' | 'grandTotal' | 'notes'>,
  items: Array<Pick<ReceiptItem, 'item' | 'category' | 'quantity' | 'unitPrice' | 'lineTotal' | 'tax'>>,
) {
  return JSON.stringify({
    storeName: receipt.storeName ?? null,
    purchaseDate: receipt.purchaseDate?.toISOString() ?? null,
    subtotal: receipt.subtotal ?? null,
    totalTax: receipt.totalTax ?? null,
    discount: receipt.discount ?? null,
    grandTotal: receipt.grandTotal ?? null,
    notes: receipt.notes ?? '',
    items: items.map((item) => ({
      item: item.item,
      category: item.category ?? null,
      quantity: item.quantity ?? null,
      unitPrice: item.unitPrice ?? null,
      lineTotal: item.lineTotal ?? null,
      tax: item.tax ?? null,
    })),
  })
}

export function getReviewStatus(items: Array<Pick<ReceiptItem, 'needsReview'>>, current?: string | null): ReviewStatus {
  if (current === 'approved') return 'approved'
  return items.some((item) => item.needsReview) ? 'needs_review' : 'needs_review'
}

export function getEditedSyncStatus(currentStatus: string | null | undefined): SyncStatus {
  if (currentStatus === 'synced') return 'stale'
  if (currentStatus === 'syncing') return 'stale'
  if (currentStatus === 'failed') return 'failed'
  return 'not_synced'
}
