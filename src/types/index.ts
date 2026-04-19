import type { Receipt, ReceiptItem, User, EditLog } from '@prisma/client'

// ─── Re-exports from Prisma ────────────────────────────────────────────────
export type { Receipt, ReceiptItem, User, EditLog }

// ─── Extended types ────────────────────────────────────────────────────────

export type ReceiptStatus = 'pending' | 'processing' | 'done' | 'failed'
export type ReviewStatus = 'needs_review' | 'approved'
export type SyncStatus = 'not_synced' | 'syncing' | 'synced' | 'failed' | 'stale'
export type UserRole = 'user' | 'admin'
export type StorageType = 'local' | 's3'
export type ExportFormat = 'csv' | 'pdf'

export interface ReceiptWithItems extends Receipt {
  items: ReceiptItem[]
  _count?: { items: number }
}

export interface ReceiptWithUser extends Receipt {
  user: Pick<User, 'id' | 'name' | 'email'>
}

export interface FullReceipt extends Receipt {
  items: ReceiptItem[]
  editLogs: EditLog[]
  user: Pick<User, 'id' | 'name' | 'email'>
}

// ─── OCR / Parsing ─────────────────────────────────────────────────────────

export interface ParsedReceiptItem {
  item: string
  quantity: number | null
  unitPrice: number | null
  lineTotal: number | null
  tax: number | null
  confidence: number
  needsReview: boolean
  sourceText?: string
}

export interface ParsedReceipt {
  storeName: string | null
  purchaseDate: string | null
  items: ParsedReceiptItem[]
  subtotal: number | null
  totalTax: number | null
  discount: number | null
  grandTotal: number | null
  rawText: string
  confidence: number
}

// ─── API Response shapes ───────────────────────────────────────────────────

export interface ApiSuccess<T = unknown> {
  ok: true
  data: T
}

export interface ApiError {
  ok: false
  error: string
  code: string
  details?: Array<{
    field?: string
    message: string
  }>
}

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiError

// ─── Upload ────────────────────────────────────────────────────────────────

export interface UploadResult {
  url: string
  key: string
  size: number
  mimeType: string
}

// ─── Calculations ──────────────────────────────────────────────────────────

export interface ReceiptTotals {
  subtotal: number
  totalTax: number
  discount: number
  grandTotal: number
  itemCount: number
  flaggedCount: number
  avgConfidence: number
}

export interface ValidationIssue {
  itemId: string
  field: string
  message: string
  severity: 'error' | 'warning'
}

// ─── Admin ─────────────────────────────────────────────────────────────────

export interface AdminMetrics {
  totalUsers: number
  totalReceipts: number
  receiptsToday: number
  parseSuccessRate: number
  avgProcessingMs: number
  failedParses: number
  recentErrors: {
    receiptId: string
    errorDetail: string
    createdAt: Date
  }[]
  topStores: { storeName: string; count: number }[]
  uploadsPerDay: { date: string; count: number }[]
}

// ─── Table editing ─────────────────────────────────────────────────────────

export interface EditableCell {
  itemId: string
  field: keyof ReceiptItem
  value: string | number | boolean | null
}

export interface DuplicateMatch {
  receiptId: string
  storeName: string | null
  purchaseDate: string | null
  grandTotal: number | null
  score: number
  reason: string
}
