import { signUpSchema, signInSchema, receiptItemSchema } from '@/lib/validators'

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
})
