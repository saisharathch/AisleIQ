import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { createPasswordResetToken, buildPasswordResetUrl } from '@/lib/tokens'
import { sendEmail, buildPasswordResetEmail } from '@/lib/email'

const schema = z.object({ email: z.string().email() })

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
  }

  const email = parsed.data.email.toLowerCase()

  // Always return 200 to avoid user enumeration
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, name: true, password: true },
  })

  if (user?.password) {
    // Only password-based accounts can reset via email
    try {
      const token = await createPasswordResetToken(email)
      const url = buildPasswordResetUrl(email, token)
      const { html, text, subject } = buildPasswordResetEmail({ name: user.name ?? '', url })
      await sendEmail({ to: email, subject, html, text })
    } catch (err) {
      console.error('[forgot-password] Failed to send reset email:', err)
    }
  }

  return NextResponse.json({ ok: true })
}
