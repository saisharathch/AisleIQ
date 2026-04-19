import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { classifyIntent, runAnalyticsQuery, formatAnswer } from '@/lib/ai-query-engine'
import { z } from 'zod'

const schema = z.object({
  question: z.string().min(2).max(500).trim(),
})

export async function POST(req: NextRequest) {
  // Auth
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Rate limit — AI calls are expensive; 10 per minute per IP
  const rl = rateLimit(req)
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 })
  }

  // Validate input
  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid question.' }, { status: 400 })
  }

  const { question } = parsed.data
  const userId = session.user.id

  // Step 1 — Classify intent (fast Claude call)
  const { intent, params } = await classifyIntent(question)

  // Step 2 — Run safe DB query (user-scoped Prisma, no raw SQL)
  const data = intent !== 'UNSUPPORTED'
    ? await runAnalyticsQuery(userId, intent, params).catch(() => null)
    : null

  // Step 3 — Format answer with Claude (grounded in DB data only)
  const answer = await formatAnswer(question, intent, params, data)

  return NextResponse.json({
    answer,
    intent,
    params,
    data,   // included for future chart rendering
  })
}
