import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { AppShell } from '@/components/layout/AppShell'
import { BudgetTracker } from '@/components/budget/BudgetTracker'

export default async function BudgetsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')

  const now   = new Date()
  const year  = now.getFullYear()
  const month = now.getMonth() + 1

  const [budgets, receipts] = await Promise.all([
    db.budget.findMany({ where: { userId: session.user.id }, orderBy: [{ year: 'desc' }, { month: 'desc' }] }),
    db.receipt.findMany({
      where: {
        userId: session.user.id,
        status: 'done',
        uploadDate: { gte: new Date(year, month - 1, 1) },
      },
      include: { items: true },
    }),
  ])

  // Compute actual spend per category this month
  const categorySpend = new Map<string, number>()
  let totalSpend = 0
  for (const r of receipts) {
    totalSpend += r.grandTotal ?? 0
    for (const item of r.items) {
      const ck = item.category ?? 'Other'
      categorySpend.set(ck, (categorySpend.get(ck) ?? 0) + (item.lineTotal ?? 0))
    }
  }

  const categoryActuals = Array.from(categorySpend.entries()).map(([category, spent]) => ({
    category, spent: +spent.toFixed(2),
  }))

  // Get all unique categories from budgets + actuals
  const allCategories = Array.from(new Set([
    ...budgets.filter((b) => b.category).map((b) => b.category!),
    ...categoryActuals.map((c) => c.category),
  ])).sort()

  return (
    <AppShell title="Budgets">
      <div className="px-4 sm:px-6 py-6 max-w-[1400px]">
        <BudgetTracker
          budgets={budgets}
          categoryActuals={categoryActuals}
          allCategories={allCategories}
          totalSpend={+totalSpend.toFixed(2)}
          currentYear={year}
          currentMonth={month}
        />
      </div>
    </AppShell>
  )
}
