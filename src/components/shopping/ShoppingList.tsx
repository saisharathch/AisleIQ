'use client'

import { useState, useEffect } from 'react'
import { ShoppingCart, RefreshCw, Check, TrendingUp, Store, Package, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/calculations'

interface SuggestedItem {
  name: string
  category: string | null
  avgPrice: number | null
  count: number
  lastBought: string
  topStore: string | null
}

const CATEGORY_COLORS: Record<string, string> = {
  'Produce': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'Dairy': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'Meat & Seafood': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  'Bakery': 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  'Frozen Foods': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  'Beverages': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'Snacks': 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  'Household': 'bg-slate-100 text-slate-800 dark:bg-slate-700/50 dark:text-slate-300',
  'Personal Care': 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  'Other': 'bg-slate-100 text-slate-700 dark:bg-slate-700/50 dark:text-slate-300',
}

function categoryColor(cat: string | null) {
  return CATEGORY_COLORS[cat ?? 'Other'] ?? CATEGORY_COLORS['Other']
}

export function ShoppingList() {
  const [items, setItems] = useState<SuggestedItem[]>([])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('All')

  async function load() {
    setLoading(true)
    const res = await fetch('/api/shopping-list')
    if (res.ok) {
      const { data } = await res.json()
      setItems(data)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function toggle(name: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  const categories = ['All', ...Array.from(new Set(items.map((i) => i.category ?? 'Other')))]
  const visible = filter === 'All' ? items : items.filter((i) => (i.category ?? 'Other') === filter)
  const unchecked = visible.filter((i) => !checked.has(i.name))
  const checkedItems = visible.filter((i) => checked.has(i.name))

  const estimatedTotal = visible
    .filter((i) => !checked.has(i.name))
    .reduce((sum, i) => sum + (i.avgPrice ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">Smart Shopping List</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Based on your last 90 days of purchase history — items you buy often
          </p>
        </div>
        <div className="flex items-center gap-2">
          {checked.size > 0 && (
            <Button size="sm" variant="outline" onClick={() => setChecked(new Set())} className="text-xs">
              Clear all checks ({checked.size})
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </Button>
        </div>
      </div>

      {/* Estimated total */}
      {unchecked.length > 0 && (
        <div className="rounded-xl border border-teal-100 bg-teal-50 dark:border-teal-900/40 dark:bg-teal-950/20 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-teal-800 dark:text-teal-300">
            <ShoppingCart className="h-4 w-4" />
            <span className="text-sm font-medium">{unchecked.length} items remaining</span>
          </div>
          <span className="text-sm font-bold text-teal-900 dark:text-teal-200">
            ~{formatCurrency(estimatedTotal)} estimated
          </span>
        </div>
      )}

      {/* Category filter */}
      {categories.length > 2 && (
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filter === cat
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading your shopping history...
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 space-y-2">
          <Package className="h-10 w-10 opacity-30" />
          <p className="text-sm font-medium">No repeat purchases found yet</p>
          <p className="text-xs max-w-xs">
            Upload and approve a few receipts. Items you buy 2+ times in 90 days will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Unchecked items */}
          {unchecked.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
              {unchecked.map((item, idx) => (
                <div
                  key={item.name}
                  onClick={() => toggle(item.name)}
                  className={`flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${
                    idx !== 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''
                  }`}
                >
                  <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                    'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {item.name}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${categoryColor(item.category)}`}>
                        {item.category ?? 'Other'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {item.topStore && (
                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Store className="h-3 w-3" />
                          {item.topStore}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-[11px] text-slate-400">
                        <TrendingUp className="h-3 w-3" />
                        Bought {item.count}× in 90 days
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    {item.avgPrice != null && (
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        ~{formatCurrency(item.avgPrice)}
                      </p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-0.5">avg price</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Checked items */}
          {checkedItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 px-1">
                In Cart ({checkedItems.length})
              </p>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900 opacity-60">
                {checkedItems.map((item, idx) => (
                  <div
                    key={item.name}
                    onClick={() => toggle(item.name)}
                    className={`flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${
                      idx !== 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''
                    }`}
                  >
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 border-teal-500 bg-teal-500">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                    <span className="text-sm text-slate-500 line-through truncate flex-1">{item.name}</span>
                    {item.avgPrice != null && (
                      <span className="text-xs text-slate-400">{formatCurrency(item.avgPrice)}</span>
                    )}
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
