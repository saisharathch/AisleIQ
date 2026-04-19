/**
 * Receipt processing worker
 *
 * Run alongside the Next.js server:
 *   npm run worker
 *
 * Flow per job:
 *   1. claimNextJob     — atomic DB claim (status guard prevents double-claim)
 *   2. parseReceiptOcr  — fetch file + run Claude OCR; NO DB writes
 *   3. commitParsedResults — single transaction: ownership check + delete old items
 *                            + create new items + mark done + ParseLog
 *   On OCR failure:
 *   3. failJob          — ownership check + schedule retry or permanent failure
 *
 * If a job is reset by a user retry between steps 2 and 3, the ownership check
 * in commitParsedResults / failJob detects it and silently discards stale results.
 */

import { randomUUID } from 'crypto'
import { db } from '@/lib/db'
import {
  claimNextJob,
  commitParsedResults,
  failJob,
  requeueStuckJobs,
  MAX_ATTEMPTS,
} from '@/lib/queue'
import { parseReceiptOcr } from '@/lib/process-receipt'

const WORKER_ID = `w-${process.pid}-${randomUUID().slice(0, 6)}`
const POLL_INTERVAL_MS = 2_000
const STUCK_CHECK_INTERVAL_MS = 60_000

let shuttingDown = false
let nextStuckCheckAt = Date.now()

// ── Main loop ─────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  log(`Worker started (max ${MAX_ATTEMPTS} attempts per job)`)

  while (!shuttingDown) {
    try {
      if (Date.now() >= nextStuckCheckAt) {
        const rescued = await requeueStuckJobs()
        if (rescued > 0) log(`Rescued ${rescued} stuck job(s)`)
        nextStuckCheckAt = Date.now() + STUCK_CHECK_INTERVAL_MS
      }

      const processed = await processNextJob()
      if (!processed) await sleep(POLL_INTERVAL_MS)
    } catch (err) {
      log('Unexpected error in main loop:', err)
      await sleep(POLL_INTERVAL_MS)
    }
  }

  log('Shutting down cleanly')
  await db.$disconnect()
}

// ── Job processing ────────────────────────────────────────────────────────────

async function processNextJob(): Promise<boolean> {
  const job = await claimNextJob(WORKER_ID)
  if (!job) return false

  const start = Date.now()
  log(`Claimed job ${job.id} | receipt ${job.receiptId} | attempt ${job.attempts}/${MAX_ATTEMPTS}`)

  try {
    // Pure OCR — no DB writes; safe to discard if job was reset
    const parsed = await parseReceiptOcr(job.receiptId)

    const durationMs = Date.now() - start
    const committed = await commitParsedResults(job.id, WORKER_ID, job.receiptId, parsed, durationMs)

    if (committed) {
      log(`Completed job ${job.id} in ${durationMs}ms`)
    } else {
      log(`Job ${job.id} was superseded by a newer retry — discarding stale results`)
    }
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err)
    const durationMs = Date.now() - start

    const recorded = await failJob(job.id, WORKER_ID, job.receiptId, error, job.attempts, durationMs)

    if (recorded) {
      if (job.attempts >= MAX_ATTEMPTS) {
        log(`Job ${job.id} permanently failed after ${job.attempts} attempts: ${error}`)
      } else {
        log(`Job ${job.id} failed (attempt ${job.attempts}/${MAX_ATTEMPTS}), will retry: ${error}`)
      }
    } else {
      log(`Job ${job.id} was superseded — failure not recorded (stale worker)`)
    }
  }

  return true
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function log(...args: unknown[]): void {
  console.log(`[${WORKER_ID}]`, new Date().toISOString(), ...args)
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────

function shutdown(signal: string): void {
  log(`Received ${signal} — finishing current job then exiting…`)
  shuttingDown = true
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

run().catch((err) => {
  console.error(`[${WORKER_ID}] Fatal error, exiting:`, err)
  process.exit(1)
})
