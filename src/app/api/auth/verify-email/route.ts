import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { consumeEmailVerificationToken } from '@/lib/tokens'

// GET /api/auth/verify-email?email=xxx&token=xxx
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')?.toLowerCase()
  const token = req.nextUrl.searchParams.get('token')

  if (!email || !token) {
    return NextResponse.json({ error: 'Missing email or token' }, { status: 400 })
  }

  const { valid, expired } = await consumeEmailVerificationToken(email, token)

  if (expired) {
    return NextResponse.json({ error: 'Verification link has expired. Please request a new one.' }, { status: 410 })
  }
  if (!valid) {
    return NextResponse.json({ error: 'Invalid or already-used verification link.' }, { status: 400 })
  }

  await db.user.update({
    where: { email },
    data: { emailVerified: new Date() },
  })

  return NextResponse.json({ ok: true })
}

// POST /api/auth/verify-email/resend  — handled separately below
// This endpoint resends the verification email for the authenticated user
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { email?: string }
  const email = body.email?.toLowerCase()

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { email } })
  if (!user) {
    // Don't reveal whether the user exists
    return NextResponse.json({ ok: true })
  }
  if (user.emailVerified) {
    return NextResponse.json({ error: 'Email is already verified' }, { status: 400 })
  }

  const { createEmailVerificationToken, buildVerificationUrl } = await import('@/lib/tokens')
  const { sendEmail, buildVerificationEmail } = await import('@/lib/email')

  try {
    const token = await createEmailVerificationToken(email)
    const url = buildVerificationUrl(email, token)
    const { html, text, subject } = buildVerificationEmail({ name: user.name ?? '', url })
    await sendEmail({ to: email, subject, html, text })
  } catch (err) {
    console.error('[verify-email] resend failed:', err)
    return NextResponse.json({ error: 'Failed to send email. Please try again.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
