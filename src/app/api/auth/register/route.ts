import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { getAllowedSignupEmails, isSelfSignupEnabled } from '@/lib/env'
import { signUpSchema } from '@/lib/validators'
import { createEmailVerificationToken, buildVerificationUrl } from '@/lib/tokens'
import { sendEmail, buildVerificationEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = signUpSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }

    const { name, email, password } = parsed.data
    const normalizedEmail = email.toLowerCase()
    const allowedEmails = getAllowedSignupEmails()

    if (!isSelfSignupEnabled()) {
      return NextResponse.json(
        { error: 'Self-service sign-up is disabled for this beta.' },
        { status: 403 },
      )
    }

    if (allowedEmails.length > 0 && !allowedEmails.includes(normalizedEmail)) {
      return NextResponse.json(
        { error: 'This email address is not allowed for the current beta.' },
        { status: 403 },
      )
    }

    // Check if this email came from a valid invite
    const invite = await db.invite.findFirst({
      where: { email: normalizedEmail, acceptedAt: null, expiresAt: { gt: new Date() } },
    })

    const existing = await db.user.findUnique({ where: { email: normalizedEmail } })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 })
    }

    const hashed = await bcrypt.hash(password, 12)
    const user = await db.user.create({
      // emailVerified is null — user must verify before it's set
      data: { name, email: normalizedEmail, password: hashed, emailVerified: null },
    })

    // Mark invite accepted if applicable
    if (invite) {
      await db.invite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      })
    }

    // Send verification email (fire-and-forget; never block signup on email failure)
    try {
      const token = await createEmailVerificationToken(normalizedEmail)
      const url = buildVerificationUrl(normalizedEmail, token)
      const { html, text, subject } = buildVerificationEmail({ name: name ?? '', url })
      await sendEmail({ to: normalizedEmail, subject, html, text })
    } catch (emailErr) {
      console.error('[register] Failed to send verification email:', emailErr)
    }

    return NextResponse.json({ ok: true, userId: user.id }, { status: 201 })
  } catch (err) {
    console.error('[register]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
