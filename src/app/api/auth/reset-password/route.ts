import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { consumePasswordResetToken } from '@/lib/tokens'

const schema = z.object({
  email: z.string().email(),
  token: z.string().min(1),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const { email, token, password } = parsed.data
  const normalizedEmail = email.toLowerCase()

  const { valid, expired } = await consumePasswordResetToken(normalizedEmail, token)

  if (expired) {
    return NextResponse.json({ error: 'Reset link has expired. Please request a new one.' }, { status: 410 })
  }
  if (!valid) {
    return NextResponse.json({ error: 'Invalid or already-used reset link.' }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { email: normalizedEmail } })
  if (!user) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 })
  }

  const hashed = await bcrypt.hash(password, 12)
  await db.user.update({
    where: { email: normalizedEmail },
    data: { password: hashed },
  })

  return NextResponse.json({ ok: true })
}
