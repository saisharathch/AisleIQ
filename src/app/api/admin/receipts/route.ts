import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = req.nextUrl
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = Math.min(50, parseInt(searchParams.get('limit') ?? '20'))
  const search = searchParams.get('search') ?? ''
  const status = searchParams.get('status') ?? ''

  const where = {
    ...(search ? { storeName: { contains: search } } : {}),
    ...(status ? { status } : {}),
  }

  const [receipts, total] = await Promise.all([
    db.receipt.findMany({
      where,
      orderBy: { uploadDate: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
      include: {
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { items: true } },
      },
    }),
    db.receipt.count({ where }),
  ])

  return NextResponse.json({ ok: true, data: receipts, total, page, limit })
}
