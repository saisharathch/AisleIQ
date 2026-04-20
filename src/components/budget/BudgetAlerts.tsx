'use client'

import { AlertTriangle, TrendingUp, CheckCircle2 } from 'lucide-react'

interface AlertItem {
  label: string
  spent: number
  budget: number
  percent: number
}

interface Props {
  alerts: AlertItem[]
}

export function BudgetAlerts({ alerts }: Props) {
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20 px-4 py-3">
        <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <p className="text-sm text-emerald-800 dark:text-emerald-300 font-medium">
          All budgets are on track this month.
        </p>
      </div>
    )
  }

  const overBudget = alerts.filter((a) => a.percent >= 100)
  const nearLimit  = alerts.filter((a) => a.percent >= 80 && a.percent < 100)

  return (
    <div className="space-y-3">
      {overBudget.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0" />
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">
              Over budget in {overBudget.length} categor{overBudget.length === 1 ? 'y' : 'ies'}
            </p>
          </div>
          <div className="space-y-2">
            {overBudget.map((a) => (
              <div key={a.label} className="flex items-center justify-between text-sm">
                <span className="font-medium text-red-900 dark:text-red-200">{a.label}</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-1.5 rounded-full bg-red-200 dark:bg-red-900/50 overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full" style={{ width: '100%' }} />
                  </div>
                  <span className="text-xs text-red-700 dark:text-red-400 font-medium w-16 text-right">
                    ${a.spent.toFixed(2)} / ${a.budget.toFixed(2)}
                  </span>
                  <span className="text-xs font-bold text-red-700 dark:text-red-400 w-10 text-right">
                    +{(a.percent - 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {nearLimit.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              Approaching limit in {nearLimit.length} categor{nearLimit.length === 1 ? 'y' : 'ies'}
            </p>
          </div>
          <div className="space-y-2">
            {nearLimit.map((a) => (
              <div key={a.label} className="flex items-center justify-between text-sm">
                <span className="font-medium text-amber-900 dark:text-amber-200">{a.label}</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-1.5 rounded-full bg-amber-200 dark:bg-amber-900/50 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${Math.min(a.percent, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-amber-700 dark:text-amber-400 font-medium w-16 text-right">
                    ${a.spent.toFixed(2)} / ${a.budget.toFixed(2)}
                  </span>
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 w-10 text-right">
                    {a.percent.toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
