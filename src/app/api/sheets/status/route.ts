import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

export type SheetsAuthStatus =
  | { status: 'not_connected' }
  | { status: 'missing_scope' }
  | { status: 'token_expired'; canRefresh: false }   // needs full reconnect
  | { status: 'ok'; tokenExpiresAt: number | null }

export async function GET() {
  try {
    const user = await requireAuth()

    const account = await db.account.findFirst({
      where: { userId: user.id, provider: 'google' },
      select: { scope: true, access_token: true, refresh_token: true, expires_at: true },
    })

    if (!account || !account.access_token) {
      return NextResponse.json({ status: 'not_connected' } satisfies SheetsAuthStatus)
    }

    const hasScope = account.scope?.includes('spreadsheets') ?? false
    if (!hasScope) {
      return NextResponse.json({ status: 'missing_scope' } satisfies SheetsAuthStatus)
    }

    const now = Math.floor(Date.now() / 1000)
    const expired = account.expires_at != null && account.expires_at < now + 60
    if (expired && !account.refresh_token) {
      // Token is expired and we have no way to refresh it — user must reconnect
      return NextResponse.json({ status: 'token_expired', canRefresh: false } satisfies SheetsAuthStatus)
    }

    // Token is valid (or expired but we can silently refresh it at sync time)
    return NextResponse.json({
      status: 'ok',
      tokenExpiresAt: account.expires_at ?? null,
    } satisfies SheetsAuthStatus)
  } catch {
    return NextResponse.json({ status: 'not_connected' } satisfies SheetsAuthStatus)
  }
}
