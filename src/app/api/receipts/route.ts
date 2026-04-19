import { NextRequest, NextResponse, after } from 'next/server'
import { createHash } from 'crypto'
import sharp from 'sharp'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { saveFile, validateFile } from '@/lib/storage'
import { enqueueJob, processQueuedReceiptInline } from '@/lib/queue'
import { rateLimit } from '@/lib/rate-limit'
import { errorResponse, validationErrorResponse } from '@/lib/api-errors'
import { receiptQuerySchema, receiptUploadFileSchema } from '@/lib/validators'

// GET /api/receipts - list receipts for current user
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return errorResponse(401, 'UNAUTHORIZED', 'You must be signed in.')

  const parsedQuery = receiptQuerySchema.safeParse(
    Object.fromEntries(req.nextUrl.searchParams.entries()),
  )
  if (!parsedQuery.success) {
    return validationErrorResponse(parsedQuery.error, 'Invalid receipt query.')
  }

  const { search = '', page, limit } = parsedQuery.data

  const where = {
    userId: session.user.id,
    ...(search ? { storeName: { contains: search } } : {}),
  }

  const [receipts, total] = await Promise.all([
    db.receipt.findMany({
      where,
      orderBy: { uploadDate: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
      include: { _count: { select: { items: true } } },
    }),
    db.receipt.count({ where }),
  ])

  return NextResponse.json({ ok: true, data: receipts, total, page, limit })
}

// POST /api/receipts - upload a receipt and queue it for OCR processing
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return errorResponse(401, 'UNAUTHORIZED', 'You must be signed in.')

  const rl = rateLimit(req)
  if (!rl.ok) {
    return errorResponse(429, 'RATE_LIMITED', 'Too many requests. Please wait a moment and try again.')
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) {
    return errorResponse(400, 'RECEIPT_FILE_MISSING', 'Please choose a receipt file to upload.')
  }

  const parsedFile = receiptUploadFileSchema.safeParse({
    name: file.name,
    size: file.size,
    type: file.type,
  })
  if (!parsedFile.success) {
    return validationErrorResponse(parsedFile.error, 'Invalid receipt file.')
  }

  try {
    validateFile({ size: parsedFile.data.size, type: parsedFile.data.type })
  } catch (err: unknown) {
    return errorResponse(400, 'INVALID_RECEIPT_DATA', (err as Error).message)
  }

  const arrayBuffer = await file.arrayBuffer()
  let buffer: Buffer = Buffer.from(arrayBuffer)
  let mimeType = file.type

  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    buffer = await sharp(buffer).jpeg({ quality: 90 }).toBuffer()
    mimeType = 'image/jpeg'
  }

  // Exact duplicate detection via SHA-256 of raw file bytes
  const fileHash = createHash('sha256').update(Buffer.from(arrayBuffer)).digest('hex')

  const existingReceipt = await db.receipt.findFirst({
    where: { userId: session.user.id, fileHash },
    select: { id: true, storeName: true, uploadDate: true, purchaseDate: true, grandTotal: true },
  })
  if (existingReceipt) {
    return NextResponse.json(
      {
        error: 'This receipt has already been uploaded.',
        code: 'DUPLICATE_FILE',
        existingReceiptId: existingReceipt.id,
        storeName: existingReceipt.storeName,
        date: (existingReceipt.purchaseDate ?? existingReceipt.uploadDate).toISOString(),
        grandTotal: existingReceipt.grandTotal,
      },
      { status: 409 },
    )
  }

  // Guard against the same file being submitted twice within 2 minutes (race condition)
  const recentDuplicate = await db.receipt.findFirst({
    where: {
      userId: session.user.id,
      fileName: file.name,
      fileSize: file.size,
      status: { in: ['queued', 'processing'] },
      uploadDate: { gte: new Date(Date.now() - 2 * 60 * 1000) },
    },
    select: { id: true },
  })
  if (recentDuplicate) {
    return errorResponse(
      409,
      'DUPLICATE_UPLOAD',
      'This receipt is already being uploaded or processed.',
      [{ field: 'file', message: 'Wait for the current upload to finish before trying again.' }],
    )
  }

  let stored
  try {
    stored = await saveFile(buffer, file.name, mimeType)
  } catch (err: unknown) {
    console.error('[upload] File save failed:', err)
    return errorResponse(500, 'UPLOAD_SAVE_FAILED', 'We could not save the receipt file. Please try again.')
  }

  const receipt = await db.receipt.create({
    data: {
      userId: session.user.id,
      fileUrl: stored.url,
      fileType: mimeType,
      fileName: file.name,
      fileSize: file.size,
      fileHash,
      status: 'queued',
    },
  })

  await enqueueJob(receipt.id)

  // In dev (or when OCR_INLINE_FALLBACK=true), process the receipt inline after
  // the response is sent so the user doesn't need to run a separate worker.
  if (process.env.OCR_INLINE_FALLBACK !== 'false' && process.env.NODE_ENV !== 'production') {
    after(() => processQueuedReceiptInline(receipt.id).catch((err) => {
      console.error('[inline-ocr] upload fallback failed:', err)
    }))
  }

  return NextResponse.json({ ok: true, data: receipt }, { status: 202 })
}
