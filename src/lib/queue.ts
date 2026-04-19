import { db } from './db'
import { predictLearnedCategory } from './category-learning'
import { refreshDuplicateDetection } from './duplicate-detection'
import { parseReceiptOcr } from './process-receipt'
import { buildReceiptSyncHash } from './receipt-state'
import type { ParsedReceipt } from '@/types'

export const MAX_ATTEMPTS = 3

const RETRY_DELAYS_MS: Record<number, number> = { 1: 30_000, 2: 5 * 60_000 }
const STUCK_THRESHOLD_MS = 5 * 60_000

export class ProcessingConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProcessingConflictError'
  }
}

export async function enqueueJob(receiptId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const existing = await tx.job.findUnique({ where: { receiptId } })

    if (existing?.status === 'processing') {
      throw new ProcessingConflictError(
        'Receipt is currently being processed. Wait for it to finish or time out before retrying.',
      )
    }

    await tx.job.upsert({
      where: { receiptId },
      create: {
        receiptId,
        status: 'queued',
        nextAttemptAt: new Date(),
      },
      update: {
        status: 'queued',
        attempts: 0,
        lastError: null,
        lockedAt: null,
        lockedBy: null,
        nextAttemptAt: new Date(),
      },
    })

    await tx.receipt.update({
      where: { id: receiptId },
      data: { status: 'queued', errorMessage: null, reviewStatus: 'needs_review' },
    })
  })
}

export async function claimNextJob(workerId: string) {
  return db.$transaction(async (tx) => {
    const candidate = await tx.job.findFirst({
      where: {
        status: 'queued',
        nextAttemptAt: { lte: new Date() },
      },
      orderBy: { nextAttemptAt: 'asc' },
    })
    if (!candidate) return null

    const claimed = await tx.job.updateMany({
      where: { id: candidate.id, status: 'queued' },
      data: {
        status: 'processing',
        lockedAt: new Date(),
        lockedBy: workerId,
        attempts: { increment: 1 },
      },
    })
    if (claimed.count === 0) return null

    await tx.receipt.update({
      where: { id: candidate.receiptId },
      data: { status: 'processing' },
    })

    return tx.job.findUnique({ where: { id: candidate.id } })
  })
}

export async function claimJobForReceipt(receiptId: string, workerId: string) {
  return db.$transaction(async (tx) => {
    const candidate = await tx.job.findFirst({
      where: {
        receiptId,
        status: 'queued',
        nextAttemptAt: { lte: new Date() },
      },
    })
    if (!candidate) return null

    const claimed = await tx.job.updateMany({
      where: { id: candidate.id, status: 'queued' },
      data: {
        status: 'processing',
        lockedAt: new Date(),
        lockedBy: workerId,
        attempts: { increment: 1 },
      },
    })
    if (claimed.count === 0) return null

    await tx.receipt.update({
      where: { id: receiptId },
      data: { status: 'processing', errorMessage: null },
    })

    return tx.job.findUnique({ where: { id: candidate.id } })
  })
}

export async function commitParsedResults(
  jobId: string,
  workerId: string,
  receiptId: string,
  parsed: ParsedReceipt,
  durationMs: number,
): Promise<boolean> {
  try {
    await db.$transaction(async (tx) => {
      const job = await tx.job.findUnique({ where: { id: jobId } })
      if (!job || job.lockedBy !== workerId) {
        throw new StaleJobError()
      }

      const existingReceipt = await tx.receipt.findUnique({
        where: { id: receiptId },
        select: {
          userId: true,
          notes: true,
        },
      })
      if (!existingReceipt) throw new Error('Receipt not found')

      const categorizedItems = await Promise.all(
        parsed.items.map(async (item) => ({
          ...item,
          category: await predictLearnedCategory(existingReceipt.userId, item.item, tx),
        })),
      )

      const purchaseDate = parsed.purchaseDate ? new Date(parsed.purchaseDate) : null
      const syncHash = buildReceiptSyncHash(
        {
          storeName: parsed.storeName,
          purchaseDate,
          subtotal: parsed.subtotal,
          totalTax: parsed.totalTax,
          discount: parsed.discount,
          grandTotal: parsed.grandTotal,
          notes: existingReceipt.notes,
        },
        categorizedItems,
      )

      await tx.receiptItem.deleteMany({ where: { receiptId } })

      await tx.receipt.update({
        where: { id: receiptId },
        data: {
          storeName: parsed.storeName,
          purchaseDate,
          ocrRawText: parsed.rawText,
          subtotal: parsed.subtotal,
          totalTax: parsed.totalTax,
          discount: parsed.discount,
          grandTotal: parsed.grandTotal,
          overallConfidence: parsed.confidence,
          reviewStatus: 'needs_review',
          reviewedAt: null,
          syncStatus: 'not_synced',
          syncErrorMessage: null,
          syncAttempts: 0,
          lastSyncHash: syncHash,
          duplicateOfReceiptId: null,
          duplicateScore: null,
          duplicateReason: null,
          duplicateOverride: false,
          status: 'done',
          processedAt: new Date(),
          items: {
            create: categorizedItems.map((item, i) => ({
              store: parsed.storeName,
              item: item.item,
              category: item.category,
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

      await tx.job.update({
        where: { id: jobId },
        data: { status: 'done', lockedAt: null, lockedBy: null, lastError: null },
      })

      await tx.parseLog.create({
        data: { receiptId, success: true, duration: durationMs, model: process.env.ANTHROPIC_OCR_MODEL ?? 'claude-haiku-4-5-20251001' },
      })
    })

    await refreshDuplicateDetection(receiptId)

    return true
  } catch (err) {
    if (err instanceof StaleJobError) return false
    throw err
  }
}

export async function failJob(
  jobId: string,
  workerId: string,
  receiptId: string,
  error: string,
  attempts: number,
  durationMs: number,
): Promise<boolean> {
  const permanent = attempts >= MAX_ATTEMPTS
  const delayMs = RETRY_DELAYS_MS[attempts] ?? RETRY_DELAYS_MS[MAX_ATTEMPTS - 1]
  const nextAttemptAt = permanent ? new Date() : new Date(Date.now() + delayMs)

  try {
    await db.$transaction(async (tx) => {
      const job = await tx.job.findUnique({ where: { id: jobId } })
      if (!job || job.lockedBy !== workerId) throw new StaleJobError()

      await tx.job.update({
        where: { id: jobId },
        data: {
          status: permanent ? 'failed' : 'queued',
          lastError: error,
          lockedAt: null,
          lockedBy: null,
          nextAttemptAt,
        },
      })

      await tx.receipt.update({
        where: { id: receiptId },
        data: permanent
          ? { status: 'failed', errorMessage: error, syncStatus: 'not_synced' }
          : { status: 'queued' },
      })

      await tx.parseLog.create({
        data: {
          receiptId,
          success: false,
          duration: durationMs,
          model: process.env.ANTHROPIC_OCR_MODEL ?? 'claude-haiku-4-5-20251001',
          errorDetail: error,
        },
      })
    })

    return true
  } catch (err) {
    if (err instanceof StaleJobError) return false
    throw err
  }
}

export async function requeueStuckJobs(): Promise<number> {
  const threshold = new Date(Date.now() - STUCK_THRESHOLD_MS)

  const stuck = await db.job.findMany({
    where: {
      status: 'processing',
      lockedAt: { lt: threshold },
      attempts: { lt: MAX_ATTEMPTS },
    },
    select: { id: true, receiptId: true },
  })

  if (stuck.length === 0) return 0

  const ids = stuck.map((job) => job.id)
  const receiptIds = stuck.map((job) => job.receiptId)

  await db.$transaction([
    db.job.updateMany({
      where: { id: { in: ids } },
      data: { status: 'queued', lockedAt: null, lockedBy: null, nextAttemptAt: new Date() },
    }),
    db.receipt.updateMany({
      where: { id: { in: receiptIds } },
      data: { status: 'queued' },
    }),
  ])

  return stuck.length
}

export async function getQueueStats() {
  const rows = await db.job.groupBy({
    by: ['status'],
    _count: { id: true },
  })
  return Object.fromEntries(rows.map((row) => [row.status, row._count.id])) as Record<string, number>
}

export async function processQueuedReceiptInline(receiptId: string): Promise<boolean> {
  const workerId = `inline-${process.pid}`
  const job = await claimJobForReceipt(receiptId, workerId)
  if (!job) return false

  const start = Date.now()

  try {
    const parsed = await parseReceiptOcr(job.receiptId)
    const committed = await commitParsedResults(job.id, workerId, job.receiptId, parsed, Date.now() - start)
    return committed
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err)
    await failJob(job.id, workerId, job.receiptId, error, job.attempts, Date.now() - start)
    return false
  }
}

class StaleJobError extends Error {
  constructor() {
    super('STALE_JOB')
    this.name = 'StaleJobError'
  }
}
