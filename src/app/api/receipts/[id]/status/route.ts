import { NextRequest, NextResponse, after } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { errorResponse } from '@/lib/api-errors'
import { processQueuedReceiptInline } from '@/lib/queue'

type Params = { params: Promise<{ id: string }> }

// GET /api/receipts/:id/status - lightweight poll endpoint
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return errorResponse(401, 'UNAUTHORIZED', 'You must be signed in.')

  const { id } = await params
  const receipt = await db.receipt.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, status: true, errorMessage: true, storeName: true, processedAt: true },
  })

  if (!receipt) return errorResponse(404, 'RECEIPT_NOT_FOUND', 'Receipt not found.')

  // In dev, kick off inline processing on each poll tick if the job is still queued.
  // claimJobForReceipt is idempotent — it's a no-op if the job was already claimed.
  if (receipt.status === 'queued' && process.env.OCR_INLINE_FALLBACK !== 'false' && process.env.NODE_ENV !== 'production') {
    after(() => processQueuedReceiptInline(id).catch((err) => {
      console.error('[inline-ocr] status-poll fallback failed:', err)
    }))
  }

  return NextResponse.json({ ok: true, data: receipt })
}
