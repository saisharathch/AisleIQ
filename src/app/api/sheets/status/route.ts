import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const user = await requireAuth()

    const account = await db.account.findFirst({
      where: { userId: user.id, provider: 'google' },
      select: { scope: true, access_token: true, refresh_token: true },
    })

    if (!account) {
      return NextResponse.json({ connected: false, hasScope: false })
    }

    const hasScope = account.scope?.includes('spreadsheets') ?? false

    return NextResponse.json({ connected: true, hasScope, needsReconnect: !hasScope })
  } catch {
    return NextResponse.json({ connected: false, hasScope: false })
  }
}
