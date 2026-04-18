import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

type Params = { params: Promise<{ id: string }> }

// GET /api/receipts/:id/status — lightweight poll endpoint
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const receipt = await db.receipt.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, status: true, errorMessage: true, storeName: true, processedAt: true },
  })

  if (!receipt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true, data: receipt })
}
