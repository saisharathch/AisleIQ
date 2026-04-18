import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { rateLimit } from '@/lib/rate-limit'

type Params = { params: Promise<{ id: string }> }

// POST /api/receipts/:id/retry — re-process a failed receipt
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(req)
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const { id } = await params
  const receipt = await db.receipt.findFirst({ where: { id, userId: session.user.id } })
  if (!receipt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (receipt.status === 'processing') {
    return NextResponse.json({ error: 'Receipt is already being processed' }, { status: 409 })
  }
  if (!receipt.fileUrl) {
    return NextResponse.json({ error: 'No file available to retry' }, { status: 422 })
  }

  // Kick off re-processing asynchronously
  ;(async () => {
    try {
      const { processReceipt } = await import('@/lib/process-receipt')
      await processReceipt(id)
    } catch (err) {
      console.error('[retry]', err)
    }
  })()

  return NextResponse.json({ ok: true, message: 'Retry started' }, { status: 202 })
}
