import { z } from 'zod'

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
  item: z.string().min(1, 'Item name is required').max(255),
  quantity: z.number().positive().nullable().optional(),
  unitPrice: z.number().min(0).nullable().optional(),
  lineTotal: z.number().min(0).nullable().optional(),
  tax: z.number().min(0).nullable().optional(),
  needsReview: z.boolean().optional(),
})

export const updateReceiptSchema = z.object({
  storeName: z.string().max(255).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  subtotal: z.number().min(0).nullable().optional(),
  totalTax: z.number().min(0).nullable().optional(),
  discount: z.number().min(0).nullable().optional(),
  grandTotal: z.number().min(0).nullable().optional(),
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
