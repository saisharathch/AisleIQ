import { db } from './db'
import type { DuplicateMatch } from '@/types'

type ReceiptRepo = Pick<typeof db, 'receipt'>

function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(value: string | null | undefined) {
  return new Set(
    normalizeText(value)
      .split(' ')
      .filter((token) => token.length > 2),
  )
}

function jaccardSimilarity(a: Set<string>, b: Set<string>) {
  if (a.size === 0 || b.size === 0) return 0
  let intersection = 0
  for (const token of a) {
    if (b.has(token)) intersection++
  }
  return intersection / (a.size + b.size - intersection)
}

function isSameDay(a: Date | null, b: Date | null) {
  if (!a || !b) return false
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10)
}

export async function findDuplicateMatchForReceipt(
  receiptId: string,
  repo: ReceiptRepo = db,
): Promise<DuplicateMatch | null> {
  const target = await repo.receipt.findUnique({
    where: { id: receiptId },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!target) return null

  const candidates = await repo.receipt.findMany({
    where: {
      userId: target.userId,
      id: { not: receiptId },
      status: 'done',
      uploadDate: {
        gte: new Date(target.uploadDate.getTime() - 90 * 24 * 60 * 60 * 1000),
      },
    },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
    take: 50,
  })

  const targetItemTokens = tokenize(target.items.map((item) => item.item).join(' '))
  const targetTextTokens = tokenize(target.ocrRawText)
  let bestMatch: DuplicateMatch | null = null

  for (const candidate of candidates) {
    let score = 0
    const reasons: string[] = []

    if (
      target.storeName &&
      candidate.storeName &&
      normalizeText(target.storeName) === normalizeText(candidate.storeName)
    ) {
      score += 0.3
      reasons.push('same store')
    }

    if (isSameDay(target.purchaseDate ?? target.uploadDate, candidate.purchaseDate ?? candidate.uploadDate)) {
      score += 0.25
      reasons.push('same date')
    }

    if (
      target.grandTotal != null &&
      candidate.grandTotal != null &&
      Math.abs(target.grandTotal - candidate.grandTotal) <= 0.01
    ) {
      score += 0.2
      reasons.push('same total')
    }

    const itemSimilarity = jaccardSimilarity(
      targetItemTokens,
      tokenize(candidate.items.map((item) => item.item).join(' ')),
    )
    if (itemSimilarity >= 0.6) {
      score += 0.15
      reasons.push('very similar items')
    } else if (itemSimilarity >= 0.35) {
      score += 0.08
      reasons.push('similar items')
    }

    const textSimilarity = jaccardSimilarity(targetTextTokens, tokenize(candidate.ocrRawText))
    if (textSimilarity >= 0.55) {
      score += 0.1
      reasons.push('similar OCR text')
    } else if (textSimilarity >= 0.35) {
      score += 0.05
      reasons.push('overlapping OCR text')
    }

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = {
        receiptId: candidate.id,
        storeName: candidate.storeName,
        purchaseDate: (candidate.purchaseDate ?? candidate.uploadDate).toISOString(),
        grandTotal: candidate.grandTotal,
        score: Math.min(1, Number(score.toFixed(2))),
        reason: reasons.join(', ') || 'possible duplicate',
      }
    }
  }

  if (!bestMatch || bestMatch.score < 0.55) return null
  return bestMatch
}

export async function refreshDuplicateDetection(
  receiptId: string,
  repo: ReceiptRepo = db,
) {
  const receipt = await repo.receipt.findUnique({
    where: { id: receiptId },
    select: { id: true, duplicateOverride: true },
  })
  if (!receipt) return null

  const match = await findDuplicateMatchForReceipt(receiptId, repo)

  await repo.receipt.update({
    where: { id: receiptId },
    data: match
      ? {
          duplicateOfReceiptId: match.receiptId,
          duplicateScore: match.score,
          duplicateReason: match.reason,
          ...(receipt.duplicateOverride ? {} : { duplicateOverride: false }),
        }
      : {
          duplicateOfReceiptId: null,
          duplicateScore: null,
          duplicateReason: null,
          ...(receipt.duplicateOverride ? {} : { duplicateOverride: false }),
        },
  })

  return match
}
