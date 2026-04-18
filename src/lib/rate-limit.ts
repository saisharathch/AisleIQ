import { NextRequest } from 'next/server'

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()
const RPM = parseInt(process.env.RATE_LIMIT_RPM ?? '30')

export function rateLimit(req: NextRequest): { ok: boolean; remaining: number } {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  const now = Date.now()
  const windowMs = 60_000

  const entry = store.get(ip)
  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: RPM - 1 }
  }

  entry.count++
  if (entry.count > RPM) {
    return { ok: false, remaining: 0 }
  }
  return { ok: true, remaining: RPM - entry.count }
}

// Clean up stale entries periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now()
    store.forEach((val, key) => { if (now > val.resetAt) store.delete(key) })
  }, 5 * 60_000)
}
