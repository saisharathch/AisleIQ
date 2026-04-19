import { parseReceiptFromBase64, parseReceiptFromText, normalizeMediaType } from './ocr'
import { db } from './db'
import type { ParsedReceipt } from '@/types'
import sharp from 'sharp'

/**
 * Fetch the stored file and run OCR. Returns parsed data — makes NO database writes.
 *
 * Keeping this function side-effect-free means:
 *   - It is safe to call even if the job was already reset by a retry.
 *   - The caller (worker) decides whether the results are still relevant before
 *     committing them (see queue.commitParsedResults).
 *   - Crashes mid-OCR leave zero DB state to clean up.
 *
 * Throws on any failure so the worker can handle retry / backoff.
 */
export async function parseReceiptOcr(receiptId: string): Promise<ParsedReceipt> {
  const receipt = await db.receipt.findUnique({ where: { id: receiptId } })
  if (!receipt) throw new Error('Receipt not found')
  if (!receipt.fileUrl) throw new Error('No file to process')

  // ── Fetch file bytes ──────────────────────────────────────────────────────────
  let buffer: Buffer
  let mimeType = receipt.fileType

  const storageType = process.env.STORAGE_TYPE ?? 'local'
  if (storageType === 's3') {
    const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3')
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
    const bucket = process.env.AWS_S3_BUCKET
    if (!accessKeyId || !secretAccessKey || !bucket) {
      throw new Error(
        'S3 credentials not configured (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_S3_BUCKET)',
      )
    }
    const s3 = new S3Client({
      region: process.env.AWS_REGION ?? 'us-east-1',
      endpoint: process.env.AWS_S3_ENDPOINT,
      credentials: { accessKeyId, secretAccessKey },
    })
    const key = receipt.fileUrl.startsWith('https://')
      ? receipt.fileUrl.split('/').slice(3).join('/')
      : receipt.fileUrl
    const resp = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    const chunks: Uint8Array[] = []
    for await (const chunk of resp.Body as AsyncIterable<Uint8Array>) chunks.push(chunk)
    buffer = Buffer.concat(chunks)
  } else {
    const fs = await import('fs/promises')
    const path = await import('path')
    const localPath = path.join(process.cwd(), 'public', receipt.fileUrl)
    buffer = await fs.readFile(localPath)
  }

  // ── HEIC → JPEG conversion ────────────────────────────────────────────────────
  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    buffer = await sharp(buffer).jpeg({ quality: 90 }).toBuffer()
    mimeType = 'image/jpeg'
  }

  if (mimeType.startsWith('image/')) {
    const optimized = await optimizeImageForOcr(buffer, mimeType)
    buffer = optimized.buffer
    mimeType = optimized.mimeType
  }

  // ── OCR ───────────────────────────────────────────────────────────────────────
  if (mimeType === 'application/pdf') {
    const { default: pdfParse } = await import('pdf-parse')
    const data = await pdfParse(buffer)
    return parseReceiptFromText(data.text)
  }

  const base64 = buffer.toString('base64')
  const normalizedMime = normalizeMediaType(mimeType)
  return parseReceiptFromBase64(base64, normalizedMime)
}

async function optimizeImageForOcr(buffer: Buffer, mimeType: string) {
  const shouldKeepPng = mimeType === 'image/png'

  const pipeline = sharp(buffer, { failOn: 'none' })
    .rotate()
    .resize({
      width: 1800,
      height: 2400,
      fit: 'inside',
      withoutEnlargement: true,
    })

  if (shouldKeepPng) {
    return {
      buffer: await pipeline.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer(),
      mimeType: 'image/png' as const,
    }
  }

  return {
    buffer: await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer(),
    mimeType: 'image/jpeg' as const,
  }
}
