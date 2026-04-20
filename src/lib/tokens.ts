import { randomBytes } from 'crypto'
import { db } from './db'

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex')
}

function getBaseUrl(): string {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL.replace(/\/$/, '')
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  return 'http://localhost:3000'
}

// ─── Email verification ────────────────────────────────────────────────────

const VERIFY_PREFIX = 'verify:'

export async function createEmailVerificationToken(email: string): Promise<string> {
  const token = generateToken()
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 h
  const identifier = `${VERIFY_PREFIX}${email}`

  // Remove any existing token first
  await db.verificationToken.deleteMany({ where: { identifier } })

  await db.verificationToken.create({ data: { identifier, token, expires } })
  return token
}

export function buildVerificationUrl(email: string, token: string): string {
  const params = new URLSearchParams({ email, token })
  return `${getBaseUrl()}/verify-email?${params.toString()}`
}

export async function consumeEmailVerificationToken(
  email: string,
  token: string,
): Promise<{ valid: boolean; expired: boolean }> {
  const identifier = `${VERIFY_PREFIX}${email}`
  const record = await db.verificationToken.findUnique({
    where: { identifier_token: { identifier, token } },
  })

  if (!record) return { valid: false, expired: false }
  if (record.expires < new Date()) {
    await db.verificationToken.delete({ where: { identifier_token: { identifier, token } } })
    return { valid: false, expired: true }
  }

  await db.verificationToken.delete({ where: { identifier_token: { identifier, token } } })
  return { valid: true, expired: false }
}

// ─── Password reset ────────────────────────────────────────────────────────

const RESET_PREFIX = 'reset:'

export async function createPasswordResetToken(email: string): Promise<string> {
  const token = generateToken()
  const expires = new Date(Date.now() + 60 * 60 * 1000) // 1 h
  const identifier = `${RESET_PREFIX}${email}`

  await db.verificationToken.deleteMany({ where: { identifier } })
  await db.verificationToken.create({ data: { identifier, token, expires } })
  return token
}

export function buildPasswordResetUrl(email: string, token: string): string {
  const params = new URLSearchParams({ email, token })
  return `${getBaseUrl()}/reset-password?${params.toString()}`
}

export async function consumePasswordResetToken(
  email: string,
  token: string,
): Promise<{ valid: boolean; expired: boolean }> {
  const identifier = `${RESET_PREFIX}${email}`
  const record = await db.verificationToken.findUnique({
    where: { identifier_token: { identifier, token } },
  })

  if (!record) return { valid: false, expired: false }
  if (record.expires < new Date()) {
    await db.verificationToken.delete({ where: { identifier_token: { identifier, token } } })
    return { valid: false, expired: true }
  }

  await db.verificationToken.delete({ where: { identifier_token: { identifier, token } } })
  return { valid: true, expired: false }
}
