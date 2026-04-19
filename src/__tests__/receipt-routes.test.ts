/** @jest-environment node */

import { NextRequest } from 'next/server'
import { GET as getReceipts, POST as postReceipt } from '@/app/api/receipts/route'
import { POST as retryReceipt } from '@/app/api/receipts/[id]/retry/route'
import { PATCH as patchReceipt } from '@/app/api/receipts/[id]/route'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { saveFile, validateFile } from '@/lib/storage'
import { enqueueJob, ProcessingConflictError } from '@/lib/queue'
import { rateLimit } from '@/lib/rate-limit'
import { refreshDuplicateDetection } from '@/lib/duplicate-detection'

jest.mock('sharp', () => jest.fn(() => ({
  jpeg: jest.fn().mockReturnThis(),
  toBuffer: jest.fn(async () => Buffer.from('converted')),
})))

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}))

jest.mock('@/lib/db', () => ({
  db: {
    receipt: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    editLog: {
      create: jest.fn(),
    },
  },
}))

jest.mock('@/lib/storage', () => ({
  saveFile: jest.fn(),
  validateFile: jest.fn(),
}))

jest.mock('@/lib/queue', () => ({
  enqueueJob: jest.fn(),
  ProcessingConflictError: class ProcessingConflictError extends Error {},
}))

jest.mock('@/lib/rate-limit', () => ({
  rateLimit: jest.fn(),
}))

jest.mock('@/lib/duplicate-detection', () => ({
  refreshDuplicateDetection: jest.fn(),
}))

const mockedAuth = jest.mocked(auth)
const mockedDb = db as unknown as {
  receipt: {
    findMany: jest.Mock
    count: jest.Mock
    findFirst: jest.Mock
    create: jest.Mock
    update: jest.Mock
  }
  editLog: {
    create: jest.Mock
  }
}
const mockedSaveFile = jest.mocked(saveFile)
const mockedValidateFile = jest.mocked(validateFile)
const mockedEnqueueJob = jest.mocked(enqueueJob)
const mockedRateLimit = jest.mocked(rateLimit)
const mockedRefreshDuplicateDetection = jest.mocked(refreshDuplicateDetection)

function makeSession() {
  return { user: { id: 'user-1' } }
}

function makeReceipt(overrides: Record<string, unknown> = {}) {
  return {
    id: 'receipt-1',
    userId: 'user-1',
    fileUrl: '/uploads/r1.jpg',
    fileType: 'image/jpeg',
    fileName: 'receipt.jpg',
    fileSize: 1200,
    status: 'queued',
    purchaseDate: null,
    subtotal: 12.34,
    totalTax: 1.23,
    discount: 0,
    grandTotal: 13.57,
    notes: null,
    reviewStatus: 'needs_review',
    reviewedAt: null,
    syncStatus: 'not_synced',
    syncErrorMessage: null,
    lastSyncHash: null,
    duplicateOverride: false,
    items: [],
    uploadDate: new Date(),
    ...overrides,
  }
}

async function readJson(res: Response) {
  return res.json()
}

describe('receipt pilot routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedAuth.mockResolvedValue(makeSession() as never)
    mockedRateLimit.mockReturnValue({ ok: true } as never)
    mockedDb.receipt.findFirst.mockResolvedValue(null)
    mockedDb.receipt.create.mockResolvedValue(makeReceipt())
    mockedDb.receipt.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => makeReceipt(data))
    mockedDb.receipt.findMany.mockResolvedValue([])
    mockedDb.receipt.count.mockResolvedValue(0)
    mockedDb.editLog.create.mockResolvedValue({ id: 'log-1' })
    mockedSaveFile.mockResolvedValue({
      url: '/uploads/r1.jpg',
      key: 'r1.jpg',
      size: 1200,
      mimeType: 'image/jpeg',
    } as never)
    mockedEnqueueJob.mockResolvedValue(undefined)
    mockedRefreshDuplicateDetection.mockResolvedValue(null)
  })

  it('uploads a receipt and queues OCR processing', async () => {
    const form = new FormData()
    form.append('file', new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' }))

    const req = new NextRequest('http://localhost/api/receipts', {
      method: 'POST',
      body: form,
    })

    const res = await postReceipt(req)
    const body = await readJson(res)

    expect(res.status).toBe(202)
    expect(mockedValidateFile).toHaveBeenCalledWith(expect.objectContaining({ type: 'image/jpeg' }))
    expect(mockedSaveFile).toHaveBeenCalled()
    expect(mockedDb.receipt.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'user-1',
        fileName: 'receipt.jpg',
        status: 'queued',
      }),
    }))
    expect(mockedEnqueueJob).toHaveBeenCalledWith('receipt-1')
    expect(body.ok).toBe(true)
  })

  it('blocks duplicate uploads that are already queued or processing', async () => {
    mockedDb.receipt.findFirst.mockResolvedValueOnce({ id: 'receipt-active' })

    const form = new FormData()
    form.append('file', new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' }))

    const req = new NextRequest('http://localhost/api/receipts', {
      method: 'POST',
      body: form,
    })

    const res = await postReceipt(req)
    const body = await readJson(res)

    expect(res.status).toBe(409)
    expect(body.code).toBe('DUPLICATE_UPLOAD')
    expect(mockedDb.receipt.create).not.toHaveBeenCalled()
    expect(mockedEnqueueJob).not.toHaveBeenCalled()
  })

  it('rejects unauthorized upload attempts', async () => {
    mockedAuth.mockResolvedValueOnce(null as never)

    const form = new FormData()
    form.append('file', new File(['receipt'], 'receipt.jpg', { type: 'image/jpeg' }))

    const req = new NextRequest('http://localhost/api/receipts', {
      method: 'POST',
      body: form,
    })

    const res = await postReceipt(req)
    const body = await readJson(res)

    expect(res.status).toBe(401)
    expect(body.code).toBe('UNAUTHORIZED')
  })

  it('validates receipt list query params', async () => {
    const req = new NextRequest('http://localhost/api/receipts?page=abc')

    const res = await getReceipts(req)
    const body = await readJson(res)

    expect(res.status).toBe(400)
    expect(body.code).toBe('VALIDATION_ERROR')
  })

  it('queues a retry for a failed receipt', async () => {
    mockedDb.receipt.findFirst.mockResolvedValueOnce(makeReceipt({
      id: 'receipt-failed',
      status: 'failed',
      fileUrl: '/uploads/failed.jpg',
    }))

    const req = new NextRequest('http://localhost/api/receipts/receipt-failed/retry', {
      method: 'POST',
      body: JSON.stringify({ action: 'retry' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await retryReceipt(req, { params: Promise.resolve({ id: 'receipt-failed' }) })
    const body = await readJson(res)

    expect(res.status).toBe(202)
    expect(body.ok).toBe(true)
    expect(mockedEnqueueJob).toHaveBeenCalledWith('receipt-failed')
  })

  it('rejects invalid retry actions', async () => {
    const req = new NextRequest('http://localhost/api/receipts/receipt-failed/retry', {
      method: 'POST',
      body: JSON.stringify({ action: 'start-over' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await retryReceipt(req, { params: Promise.resolve({ id: 'receipt-failed' }) })
    const body = await readJson(res)

    expect(res.status).toBe(400)
    expect(body.code).toBe('VALIDATION_ERROR')
    expect(mockedEnqueueJob).not.toHaveBeenCalled()
  })

  it('prevents retry while processing is already in flight', async () => {
    mockedDb.receipt.findFirst.mockResolvedValueOnce(makeReceipt({
      id: 'receipt-processing',
      status: 'processing',
      fileUrl: '/uploads/processing.jpg',
    }))
    mockedEnqueueJob.mockRejectedValueOnce(
      new ProcessingConflictError('already processing'),
    )

    const req = new NextRequest('http://localhost/api/receipts/receipt-processing/retry', {
      method: 'POST',
      body: JSON.stringify({ action: 'retry' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await retryReceipt(req, { params: Promise.resolve({ id: 'receipt-processing' }) })
    const body = await readJson(res)

    expect(res.status).toBe(409)
    expect(body.code).toBe('RETRY_CONFLICT')
  })

  it('hides retry access for receipts the user does not own', async () => {
    mockedDb.receipt.findFirst.mockResolvedValueOnce(null)

    const req = new NextRequest('http://localhost/api/receipts/other/retry', {
      method: 'POST',
      body: JSON.stringify({ action: 'retry' }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await retryReceipt(req, { params: Promise.resolve({ id: 'other' }) })
    const body = await readJson(res)

    expect(res.status).toBe(404)
    expect(body.code).toBe('RECEIPT_NOT_FOUND')
  })

  it('approves a receipt and saves review fields in one request', async () => {
    mockedDb.receipt.findFirst.mockResolvedValueOnce(makeReceipt({
      id: 'receipt-review',
      status: 'done',
      items: [{ id: 'item-1', item: 'Milk', category: 'Dairy', quantity: 1, unitPrice: 3.99, lineTotal: 3.99, tax: 0, needsReview: false }],
    }))
    mockedDb.receipt.update.mockResolvedValueOnce(makeReceipt({
      id: 'receipt-review',
      status: 'done',
      storeName: 'Aldi',
      notes: 'Looks right',
      reviewStatus: 'approved',
      reviewedAt: new Date('2026-04-18T20:00:00.000Z'),
    }))

    const req = new NextRequest('http://localhost/api/receipts/receipt-review', {
      method: 'PATCH',
      body: JSON.stringify({
        storeName: 'Aldi',
        notes: 'Looks right',
        reviewStatus: 'approved',
      }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await patchReceipt(req, { params: Promise.resolve({ id: 'receipt-review' }) })
    const body = await readJson(res)

    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(mockedDb.receipt.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'receipt-review' },
      data: expect.objectContaining({
        storeName: 'Aldi',
        notes: 'Looks right',
        reviewStatus: 'approved',
      }),
    }))
  })
})
