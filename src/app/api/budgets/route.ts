import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const budgets = await db.budget.findMany({
    where: { userId: session.user.id },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  })
  return NextResponse.json(budgets)
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { year, month, category, amount } = body

  if (!year || month == null || amount == null || amount <= 0) {
    return NextResponse.json({ error: 'Invalid budget data' }, { status: 400 })
  }

  const budget = await db.budget.upsert({
    where: { userId_year_month_category: { userId: session.user.id, year, month, category: category ?? null } },
    create: { userId: session.user.id, year, month, category: category ?? null, amount },
    update: { amount },
  })
  return NextResponse.json(budget)
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  await db.budget.deleteMany({ where: { id, userId: session.user.id } })
  return NextResponse.json({ ok: true })
}
