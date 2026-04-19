import {
  signUpSchema,
  signInSchema,
  receiptItemSchema,
  receiptUploadFileSchema,
  retryReceiptSchema,
  sheetsSyncSchema,
} from '@/lib/validators'

describe('signUpSchema', () => {
  it('accepts valid input', () => {
    expect(signUpSchema.safeParse({ name: 'Jane', email: 'jane@test.com', password: 'Secret1!' }).success).toBe(true)
  })
  it('rejects short password', () => {
    expect(signUpSchema.safeParse({ name: 'Jane', email: 'jane@test.com', password: 'short' }).success).toBe(false)
  })
  it('rejects password without uppercase', () => {
    expect(signUpSchema.safeParse({ name: 'Jane', email: 'jane@test.com', password: 'nouppercase1' }).success).toBe(false)
  })
  it('rejects bad email', () => {
    expect(signUpSchema.safeParse({ name: 'Jane', email: 'not-an-email', password: 'Valid1Pass' }).success).toBe(false)
  })
})

describe('signInSchema', () => {
  it('accepts valid credentials', () => {
    expect(signInSchema.safeParse({ email: 'user@test.com', password: 'anything' }).success).toBe(true)
  })
})

describe('receiptItemSchema', () => {
  it('accepts full item', () => {
    expect(
      receiptItemSchema.safeParse({ item: 'Milk', quantity: 2, unitPrice: 3.99, lineTotal: 7.98, tax: 0 }).success,
    ).toBe(true)
  })
  it('accepts item with nulls', () => {
    expect(receiptItemSchema.safeParse({ item: 'Unknown', quantity: null }).success).toBe(true)
  })
  it('rejects empty item name', () => {
    expect(receiptItemSchema.safeParse({ item: '' }).success).toBe(false)
  })
  it('rejects negative unitPrice', () => {
    expect(receiptItemSchema.safeParse({ item: 'Milk', unitPrice: -1 }).success).toBe(false)
  })
  it('rejects blank item names with only whitespace', () => {
    expect(receiptItemSchema.safeParse({ item: '   ' }).success).toBe(false)
  })
})

describe('receiptUploadFileSchema', () => {
  it('accepts a valid receipt file', () => {
    expect(receiptUploadFileSchema.safeParse({ name: 'receipt.jpg', size: 1024, type: 'image/jpeg' }).success).toBe(true)
  })

  it('rejects empty files', () => {
    expect(receiptUploadFileSchema.safeParse({ name: 'receipt.jpg', size: 0, type: 'image/jpeg' }).success).toBe(false)
  })
})

describe('retryReceiptSchema', () => {
  it('accepts empty payloads', () => {
    expect(retryReceiptSchema.safeParse({}).success).toBe(true)
  })

  it('rejects invalid retry actions', () => {
    expect(retryReceiptSchema.safeParse({ action: 'start-over' }).success).toBe(false)
  })
})

describe('sheetsSyncSchema', () => {
  it('accepts valid category overrides', () => {
    expect(
      sheetsSyncSchema.safeParse({
        force: true,
        categories: { item1: 'Produce', item2: 'Other' },
      }).success,
    ).toBe(true)
  })

  it('rejects unsupported categories', () => {
    expect(sheetsSyncSchema.safeParse({ categories: { item1: 'Pets' } }).success).toBe(false)
  })
})
