'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Plus, Trash2, Loader2, TrendingUp, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Budget {
  id: string
  year: number
  month: number
  category: string | null
  amount: number
}

interface CategoryActual {
  category: string
  spent: number
}

interface Props {
  budgets: Budget[]
  categoryActuals: CategoryActual[]
  allCategories: string[]
  totalSpend: number
  currentYear: number
  currentMonth: number
}

const MONTH_NAMES = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function ProgressBar({ spent, budget, label }: { spent: number; budget: number; label: string }) {
  const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0
  const over = spent > budget
  const warn = spent / budget >= 0.8

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-700">{label}</span>
        <div className="flex items-center gap-1.5">
          {over && <AlertTriangle className="h-3 w-3 text-rose-500" />}
          <span className={`font-semibold ${over ? 'text-rose-600' : warn ? 'text-amber-600' : 'text-slate-700'}`}>
            ${spent.toFixed(2)}
          </span>
          <span className="text-slate-400">/ ${budget.toFixed(2)}</span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            over ? 'bg-rose-500' : warn ? 'bg-amber-400' : 'bg-teal-500'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={`text-[10px] ${over ? 'text-rose-500 font-medium' : 'text-slate-400'}`}>
        {over
          ? `$${(spent - budget).toFixed(2)} over budget`
          : `$${(budget - spent).toFixed(2)} remaining`}
      </p>
    </div>
  )
}

function AddBudgetForm({ categories, onSaved, currentYear, currentMonth }: {
  categories: string[]; onSaved: () => void; currentYear: number; currentMonth: number
}) {
  const [saving, setSaving]   = useState(false)
  const [category, setCategory] = useState('')
  const [amount, setAmount]   = useState('')

  async function save() {
    const amt = parseFloat(amount)
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return }
    setSaving(true)
    const res = await fetch('/api/budgets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        year: currentYear, month: currentMonth,
        category: category || null,
        amount: amt,
      }),
    })
    setSaving(false)
    if (res.ok) { toast.success('Budget saved'); setAmount(''); setCategory(''); onSaved() }
    else toast.error('Failed to save budget')
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900 mb-3">Set a Budget</h3>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Category (optional)</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
          >
            <option value="">Overall monthly budget</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="w-36">
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Amount ($)</label>
          <input
            type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00" min="0" step="0.01"
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
            onKeyDown={(e) => e.key === 'Enter' && save()}
          />
        </div>
        <div className="flex items-end">
          <Button onClick={save} disabled={saving} className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5 w-full sm:w-auto">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

export function BudgetTracker({
  budgets, categoryActuals, allCategories, totalSpend, currentYear, currentMonth,
}: Props) {
  const router = useRouter()
  const [deleting, setDeleting] = useState<string | null>(null)

  const thisMonthBudgets = budgets.filter((b) => b.year === currentYear && b.month === currentMonth)
  const overallBudget    = thisMonthBudgets.find((b) => !b.category)
  const catBudgets       = thisMonthBudgets.filter((b) => !!b.category)

  function getSpent(category: string | null) {
    if (!category) return totalSpend
    return categoryActuals.find((c) => c.category === category)?.spent ?? 0
  }

  async function deleteBudget(id: string) {
    setDeleting(id)
    const res = await fetch('/api/budgets', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setDeleting(null)
    if (res.ok) { toast.success('Budget removed'); router.refresh() }
    else toast.error('Failed to remove budget')
  }

  const overBudgetCount = thisMonthBudgets.filter((b) => getSpent(b.category) > b.amount).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold text-slate-900">Budgets</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {MONTH_NAMES[currentMonth]} {currentYear} · ${totalSpend.toFixed(2)} spent
            {overBudgetCount > 0 && (
              <span className="ml-2 text-rose-500 font-medium">· {overBudgetCount} over budget</span>
            )}
          </p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50">
          <TrendingUp className="h-4 w-4 text-teal-600" />
        </div>
      </div>

      <AddBudgetForm
        categories={allCategories}
        onSaved={() => router.refresh()}
        currentYear={currentYear}
        currentMonth={currentMonth}
      />

      {thisMonthBudgets.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
          <p className="text-sm font-medium text-slate-500">No budgets set for this month</p>
          <p className="text-xs text-slate-400 mt-1">Use the form above to add your first budget</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Overall budget */}
          {overallBudget && (
            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-900">Overall Monthly Budget</h3>
                <button
                  onClick={() => deleteBudget(overallBudget.id)}
                  disabled={deleting === overallBudget.id}
                  className="text-slate-300 hover:text-rose-400 transition-colors"
                >
                  {deleting === overallBudget.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />}
                </button>
              </div>
              <ProgressBar
                spent={getSpent(null)}
                budget={overallBudget.amount}
                label="Total spend"
              />
            </div>
          )}

          {/* Category budgets */}
          {catBudgets.length > 0 && (
            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Category Budgets</h3>
              <div className="space-y-5">
                {catBudgets.map((b) => (
                  <div key={b.id} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <span />
                      <button
                        onClick={() => deleteBudget(b.id)}
                        disabled={deleting === b.id}
                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-400 transition-all"
                      >
                        {deleting === b.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <ProgressBar
                      spent={getSpent(b.category)}
                      budget={b.amount}
                      label={b.category!}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Categories without budgets */}
          {categoryActuals.filter((c) => !catBudgets.some((b) => b.category === c.category)).length > 0 && (
            <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Unbudgeted Categories</h3>
              <p className="text-xs text-slate-400 mb-4">Spending this month with no budget set</p>
              <div className="space-y-2">
                {categoryActuals
                  .filter((c) => !catBudgets.some((b) => b.category === c.category))
                  .sort((a, b) => b.spent - a.spent)
                  .map((c) => (
                    <div key={c.category} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">{c.category}</span>
                      <span className="font-semibold text-slate-800">${c.spent.toFixed(2)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
