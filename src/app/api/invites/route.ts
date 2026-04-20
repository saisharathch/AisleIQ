import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { generateToken } from '@/lib/tokens'
import { sendEmail, buildInviteEmail } from '@/lib/email'
import { errorResponse } from '@/lib/api-errors'

const createSchema = z.object({
  email: z.string().email('Invalid email address'),
})

function getBaseUrl(): string {
  const url = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  return url.replace(/\/$/, '')
}

// POST /api/invites — send an invite to an email address
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return errorResponse(401, 'UNAUTHORIZED', 'You must be signed in.')

  const body = await req.json().catch(() => ({}))
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
  }

  const email = parsed.data.email.toLowerCase()

  // Don't invite existing users
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return NextResponse.json({ error: 'That email address already has an account.' }, { status: 409 })
  }

  // Enforce a per-user limit: max 20 pending invites
  const pendingCount = await db.invite.count({
    where: { invitedBy: session.user.id, acceptedAt: null, expiresAt: { gt: new Date() } },
  })
  if (pendingCount >= 20) {
    return NextResponse.json({ error: 'You have reached the maximum number of pending invites (20).' }, { status: 429 })
  }

  // Expire any existing pending invite for this email from this user
  await db.invite.deleteMany({
    where: { invitedBy: session.user.id, email, acceptedAt: null },
  })

  const token = generateToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  const invite = await db.invite.create({
    data: { email, token, invitedBy: session.user.id, expiresAt },
  })

  const inviterName = session.user.name ?? session.user.email ?? 'Someone'
  const url = `${getBaseUrl()}/invite/${token}`
  const { html, text, subject } = buildInviteEmail({ inviterName, url })

  try {
    await sendEmail({ to: email, subject, html, text })
  } catch (err) {
    console.error('[invites] Failed to send invite email:', err)
    // Still return success — the invite record is created; user can resend
  }

  return NextResponse.json({ ok: true, inviteId: invite.id }, { status: 201 })
}

// GET /api/invites — list invites sent by the current user
export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return errorResponse(401, 'UNAUTHORIZED', 'You must be signed in.')

  const invites = await db.invite.findMany({
    where: { invitedBy: session.user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      expiresAt: true,
      acceptedAt: true,
      createdAt: true,
    },
  })

  return NextResponse.json({ ok: true, data: invites })
}

// DELETE /api/invites?id=xxx — revoke a pending invite
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return errorResponse(401, 'UNAUTHORIZED', 'You must be signed in.')

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Missing invite id' }, { status: 400 })

  const invite = await db.invite.findUnique({ where: { id } })
  if (!invite || invite.invitedBy !== session.user.id) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }

  await db.invite.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
