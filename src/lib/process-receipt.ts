import { db } from './db'
import { saveFile } from './storage'
import { parseReceiptFromBase64, parseReceiptFromText, normalizeMediaType } from './ocr'
import sharp from 'sharp'

export async function processReceipt(receiptId: string) {
  const start = Date.now()
  let success = false
  let errorDetail: string | undefined

  try {
    const receipt = await db.receipt.findUnique({ where: { id: receiptId } })
    if (!receipt) throw new Error('Receipt not found')

    // Mark as processing and clear any previous items on retry
    await db.receipt.update({ where: { id: receiptId }, data: { status: 'processing', errorMessage: null } })
    if (receipt.status === 'failed') {
      await db.receiptItem.deleteMany({ where: { receiptId } })
    }

    let fileUrl = receipt.fileUrl
    let mimeType = receipt.fileType

    // If no file yet (fresh upload), the caller should have set fileUrl already
    if (!fileUrl) throw new Error('No file to process')

    // Fetch the file bytes from local storage or S3
    let buffer: Buffer
    const storageType = process.env.STORAGE_TYPE ?? 'local'
    if (storageType === 's3') {
      const { S3Client, GetObjectCommand } = await import('@aws-sdk/client-s3')
      const s3 = new S3Client({
        region: process.env.AWS_REGION ?? 'us-east-1',
        endpoint: process.env.AWS_S3_ENDPOINT,
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
      })
      const key = fileUrl.startsWith('https://') ? fileUrl.split('/').slice(3).join('/') : fileUrl
      const resp = await s3.send(new GetObjectCommand({ Bucket: process.env.AWS_S3_BUCKET!, Key: key }))
      const chunks: Uint8Array[] = []
      for await (const chunk of resp.Body as AsyncIterable<Uint8Array>) chunks.push(chunk)
      buffer = Buffer.concat(chunks)
    } else {
      const fs = await import('fs/promises')
      const path = await import('path')
      const localPath = path.join(process.cwd(), 'public', fileUrl)
      buffer = await fs.readFile(localPath)
    }

    // Convert HEIC → JPEG
    if (mimeType === 'image/heic' || mimeType === 'image/heif') {
      buffer = await sharp(buffer).jpeg({ quality: 90 }).toBuffer()
      mimeType = 'image/jpeg'
    }

    let parsed
    if (mimeType === 'application/pdf') {
      const { default: pdfParse } = await import('pdf-parse')
      const data = await pdfParse(buffer)
      parsed = await parseReceiptFromText(data.text)
    } else {
      const base64 = buffer.toString('base64')
      const normalizedMime = normalizeMediaType(mimeType)
      parsed = await parseReceiptFromBase64(base64, normalizedMime)
    }

    await db.receipt.update({
      where: { id: receiptId },
      data: {
        storeName: parsed.storeName,
        ocrRawText: parsed.rawText,
        subtotal: parsed.subtotal,
        totalTax: parsed.totalTax,
        discount: parsed.discount,
        grandTotal: parsed.grandTotal,
        status: 'done',
        processedAt: new Date(),
        items: {
          create: parsed.items.map((item, i) => ({
            store: parsed.storeName,
            item: item.item,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
            tax: item.tax,
            confidence: item.confidence,
            needsReview: item.needsReview,
            sourceText: item.sourceText,
            sortOrder: i,
          })),
        },
      },
    })

    success = true
  } catch (err: unknown) {
    errorDetail = (err as Error).message
    await db.receipt.update({
      where: { id: receiptId },
      data: { status: 'failed', errorMessage: errorDetail },
    })
  } finally {
    await db.parseLog.create({
      data: {
        receiptId,
        success,
        duration: Date.now() - start,
        model: 'claude-opus-4-7',
        errorDetail,
      },
    })
  }
}
