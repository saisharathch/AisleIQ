import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import type { UploadResult } from '@/types'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')
const MAX_FILE_SIZE = parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB ?? '10') * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'application/pdf']

export async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
}

export function validateFile(file: { size: number; type: string }) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB ?? 10}MB.`)
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`Unsupported file type: ${file.type}. Allowed: JPG, PNG, HEIC, PDF.`)
  }
}

export async function saveFileLocally(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
): Promise<UploadResult> {
  await ensureUploadDir()
  const ext = originalName.split('.').pop() ?? 'bin'
  const key = `${uuidv4()}.${ext}`
  const filePath = path.join(UPLOAD_DIR, key)
  await fs.writeFile(filePath, buffer)
  return { url: `/uploads/${key}`, key, size: buffer.length, mimeType }
}

export async function deleteFileLocally(key: string) {
  try {
    await fs.unlink(path.join(UPLOAD_DIR, key))
  } catch {
    // File may not exist — ignore
  }
}

export async function saveFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
): Promise<UploadResult> {
  const storageType = process.env.STORAGE_TYPE ?? 'local'
  if (storageType === 's3') {
    return saveToS3(buffer, originalName, mimeType)
  }
  return saveFileLocally(buffer, originalName, mimeType)
}

export async function deleteFile(key: string) {
  const storageType = process.env.STORAGE_TYPE ?? 'local'
  if (storageType === 's3') {
    return deleteFromS3(key)
  }
  return deleteFileLocally(key)
}

// ─── S3 (stub — wire up when STORAGE_TYPE=s3) ──────────────────────────────

async function saveToS3(buffer: Buffer, originalName: string, mimeType: string): Promise<UploadResult> {
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
  const s3 = new S3Client({
    region: process.env.AWS_REGION ?? 'us-east-1',
    endpoint: process.env.AWS_S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })
  const ext = originalName.split('.').pop() ?? 'bin'
  const key = `receipts/${uuidv4()}.${ext}`
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET!,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }),
  )
  const url = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
  return { url, key, size: buffer.length, mimeType }
}

async function deleteFromS3(key: string) {
  const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3')
  const s3 = new S3Client({
    region: process.env.AWS_REGION ?? 'us-east-1',
    endpoint: process.env.AWS_S3_ENDPOINT,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  })
  await s3.send(new DeleteObjectCommand({ Bucket: process.env.AWS_S3_BUCKET!, Key: key }))
}
