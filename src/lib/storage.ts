import fs from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import type { UploadResult } from '@/types'
import { getStorageType } from './env'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')
const MAX_FILE_SIZE = parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB ?? '10', 10) * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'application/pdf']

function getS3Config() {
  const bucket = process.env.AWS_S3_BUCKET
  const region = process.env.AWS_REGION ?? 'us-east-1'
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('S3 storage is enabled but AWS_S3_BUCKET / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY are missing.')
  }

  return {
    bucket,
    region,
    endpoint: process.env.AWS_S3_ENDPOINT,
    accessKeyId,
    secretAccessKey,
    publicBaseUrl: process.env.AWS_S3_PUBLIC_BASE_URL,
  }
}

function buildS3PublicUrl(key: string) {
  const { bucket, region, endpoint, publicBaseUrl } = getS3Config()

  if (publicBaseUrl) {
    return `${publicBaseUrl.replace(/\/$/, '')}/${key}`
  }

  if (endpoint) {
    return `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`
  }

  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`
}

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
    // File may not exist.
  }
}

export async function saveFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string,
): Promise<UploadResult> {
  if (getStorageType() === 's3') {
    return saveToS3(buffer, originalName, mimeType)
  }
  return saveFileLocally(buffer, originalName, mimeType)
}

export async function deleteFile(key: string) {
  if (getStorageType() === 's3') {
    return deleteFromS3(key)
  }
  return deleteFileLocally(key)
}

export function resolveStorageKey(receipt: { fileUrl: string }) {
  if (receipt.fileUrl.startsWith('/uploads/')) return receipt.fileUrl.replace('/uploads/', '')
  if (receipt.fileUrl.startsWith('http://') || receipt.fileUrl.startsWith('https://')) {
    const url = new URL(receipt.fileUrl)
    const pathSegments = url.pathname.replace(/^\/+/, '').split('/').filter(Boolean)
    const bucket = process.env.AWS_S3_BUCKET?.trim()

    if (bucket && pathSegments[0] === bucket) {
      return pathSegments.slice(1).join('/')
    }

    return pathSegments.join('/')
  }
  return receipt.fileUrl
}

async function saveToS3(buffer: Buffer, originalName: string, mimeType: string): Promise<UploadResult> {
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3')
  const { region, endpoint, accessKeyId, secretAccessKey, bucket } = getS3Config()
  const s3 = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: Boolean(endpoint),
  })

  const ext = originalName.split('.').pop() ?? 'bin'
  const key = `receipts/${uuidv4()}.${ext}`

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }),
  )

  return { url: buildS3PublicUrl(key), key, size: buffer.length, mimeType }
}

async function deleteFromS3(key: string) {
  const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3')
  const { region, endpoint, accessKeyId, secretAccessKey, bucket } = getS3Config()
  const s3 = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: Boolean(endpoint),
  })

  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}
