import { z } from 'zod'
import { ITEM_CATEGORIES } from './google-sheets'

export const signUpSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
})

export const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const receiptItemSchema = z.object({
  item: z.string().trim().min(1, 'Item name is required').max(255),
  category: z.enum(ITEM_CATEGORIES).nullable().optional(),
  quantity: z.number().positive().nullable().optional(),
  unitPrice: z.number().min(0).nullable().optional(),
  lineTotal: z.number().min(0).nullable().optional(),
  tax: z.number().min(0).nullable().optional(),
  needsReview: z.boolean().optional(),
})

export const receiptUploadFileSchema = z.object({
  name: z.string().trim().min(1, 'Receipt file name is required'),
  size: z.number().int().positive('Receipt file is empty or invalid'),
  type: z.string().trim().min(1, 'Receipt file type is required'),
})

export const retryReceiptSchema = z.object({
  action: z.literal('retry', {
    errorMap: () => ({ message: 'Retry action must be "retry"' }),
  }).optional().default('retry'),
})

export const categoryValueSchema = z.enum(ITEM_CATEGORIES, {
  errorMap: () => ({ message: 'Category must be one of the supported Google Sheets categories' }),
})

export const sheetsSyncSchema = z.object({
  force: z.boolean().optional().default(false),
  categories: z.record(z.string().min(1), categoryValueSchema).default({}),
})

export const updateReceiptSchema = z.object({
  storeName: z.string().max(255).nullable().optional(),
  purchaseDate: z.string().datetime().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  subtotal: z.number().min(0).nullable().optional(),
  totalTax: z.number().min(0).nullable().optional(),
  discount: z.number().min(0).nullable().optional(),
  grandTotal: z.number().min(0).nullable().optional(),
  reviewStatus: z.enum(['needs_review', 'approved']).optional(),
  duplicateOverride: z.boolean().optional(),
  paidBy: z.string().max(100).nullable().optional(),
  splitWith: z.string().max(500).nullable().optional(), // JSON-serialized string[]
})

export const receiptQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(100).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  status: z.enum(['pending', 'processing', 'done', 'failed']).optional(),
})

export type SignUpInput = z.infer<typeof signUpSchema>
export type SignInInput = z.infer<typeof signInSchema>
export type ReceiptItemInput = z.infer<typeof receiptItemSchema>
export type UpdateReceiptInput = z.infer<typeof updateReceiptSchema>
export type ReceiptQueryInput = z.infer<typeof receiptQuerySchema>
export type ReceiptUploadFileInput = z.infer<typeof receiptUploadFileSchema>
export type RetryReceiptInput = z.infer<typeof retryReceiptSchema>
export type SheetsSyncInput = z.infer<typeof sheetsSyncSchema>
