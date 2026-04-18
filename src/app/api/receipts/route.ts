import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { saveFile, validateFile } from '@/lib/storage'
import { rateLimit } from '@/lib/rate-limit'
import sharp from 'sharp'

const MAX_FILE_BYTES = parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB ?? '10') * 1024 * 1024

// GET /api/receipts — list receipts for current user
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const search = searchParams.get('search') ?? ''
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(100, parseInt(searchParams.get('limit') ?? '20'))

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

// POST /api/receipts — upload + process a receipt
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const rl = rateLimit(req)
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  try {
    validateFile({ size: file.size, type: file.type })
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }

  // Create receipt record immediately so client can poll status
  const receipt = await db.receipt.create({
    data: {
      userId: session.user.id,
      fileUrl: '',
      fileType: file.type,
      fileName: file.name,
      fileSize: file.size,
      status: 'processing',
    },
  })

  // Run processing asynchronously — return receipt ID immediately
  scheduleProcessing(receipt.id, file).catch((err) => {
    console.error('[scheduleProcessing]', err)
  })

  return NextResponse.json({ ok: true, data: receipt }, { status: 202 })
}

async function scheduleProcessing(receiptId: string, file: File) {
  const arrayBuffer = await file.arrayBuffer()
  let buffer = Buffer.from(arrayBuffer)
  let mimeType = file.type

  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    buffer = await sharp(buffer).jpeg({ quality: 90 }).toBuffer()
    mimeType = 'image/jpeg'
  }

  const stored = await saveFile(buffer, file.name, mimeType)
  await db.receipt.update({ where: { id: receiptId }, data: { fileUrl: stored.url } })

  const { processReceipt } = await import('@/lib/process-receipt')
  await processReceipt(receiptId)
}
