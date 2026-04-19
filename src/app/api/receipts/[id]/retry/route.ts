import { NextRequest, NextResponse, after } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { enqueueJob, ProcessingConflictError, processQueuedReceiptInline } from '@/lib/queue'
import { rateLimit } from '@/lib/rate-limit'
import { errorResponse, readJsonBody, validationErrorResponse } from '@/lib/api-errors'
import { retryReceiptSchema } from '@/lib/validators'

type Params = { params: Promise<{ id: string }> }

// POST /api/receipts/:id/retry
// Allowed from: done, failed
// Blocked from: queued, processing (409)
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return errorResponse(401, 'UNAUTHORIZED', 'You must be signed in.')

  const rl = rateLimit(req)
  if (!rl.ok) {
    return errorResponse(429, 'RATE_LIMITED', 'Too many requests. Please wait a moment and try again.')
  }

  try {
    const body = await readJsonBody(req)
    const parsed = retryReceiptSchema.safeParse(body)
    if (!parsed.success) {
      return validationErrorResponse(parsed.error, 'Invalid retry action.')
    }
  } catch (err) {
    if (err instanceof Response) return err
    throw err
  }

  const { id } = await params
  const receipt = await db.receipt.findFirst({ where: { id, userId: session.user.id } })
  if (!receipt) return errorResponse(404, 'RECEIPT_NOT_FOUND', 'Receipt not found.')

  if (!receipt.fileUrl) {
    return errorResponse(422, 'INVALID_RECEIPT_DATA', 'No receipt file is available to reprocess.')
  }

  if (receipt.status === 'queued') {
    return errorResponse(409, 'DUPLICATE_RETRY', 'This receipt is already queued and will be processed shortly.')
  }

  try {
    await enqueueJob(id)
  } catch (err) {
    if (err instanceof ProcessingConflictError) {
      return errorResponse(
        409,
        'RETRY_CONFLICT',
        'This receipt is already being processed. Try again after the current run finishes.',
      )
    }
    throw err
  }

  if (process.env.OCR_INLINE_FALLBACK !== 'false' && process.env.NODE_ENV !== 'production') {
    after(() => processQueuedReceiptInline(id).catch((err) => {
      console.error('[inline-ocr] retry fallback failed:', err)
    }))
  }

  return NextResponse.json({ ok: true, message: 'Queued for reprocessing' }, { status: 202 })
}
