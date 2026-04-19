import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getQueueStats } from '@/lib/queue'

export async function GET() {
  const start = Date.now()

  try {
    await db.$queryRaw`SELECT 1`
    const dbMs = Date.now() - start
    const queue = await getQueueStats()

    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      db: { status: 'ok', latencyMs: dbMs },
      queue,
      version: process.env.npm_package_version ?? '1.0.0',
    })
  } catch (err) {
    return NextResponse.json(
      {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        db: { status: 'error', error: (err as Error).message },
      },
      { status: 503 },
    )
  }
}
