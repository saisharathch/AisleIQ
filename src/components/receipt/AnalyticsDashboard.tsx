'use client'

import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts'
import { ArrowDownRight, ArrowUpRight, TrendingUp, ShoppingCart, ReceiptText, Store } from 'lucide-react'

interface Props {
  monthlyTrend:   { month: string; total: number; count: number }[]
  categoryTotals: { category: string; total: number }[]
  storeComparison: { store: string; total: number }[]
  topItems:       { item: string; total: number }[]
  totalAllTime:   number
  totalThisMonth: number
  totalLastMonth: number
  spendDelta:     number | null
  avgReceipt:     number
  totalReceipts:  number
  countThisMonth: number
  countLastMonth: number
  recentReceiptCount: number
}

const PIE_COLORS = ['#0f766e', '#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#14b8a6']

function Tooltip$({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-medium text-slate-700 mb-1">{label}</p>
      <p className="text-teal-700 font-semibold">${payload[0].value.toFixed(2)}</p>
    </div>
  )
}

function KpiCard({ label, value, sub, delta, positive, icon: Icon }: {
  label: string; value: string; sub?: string; delta?: string | null; positive?: boolean
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">{label}</p>
          <p className="text-3xl font-bold tracking-tight text-slate-900 leading-none truncate">{value}</p>
          {delta != null && (
            <div className={`mt-2.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              positive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}>
              {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {delta}
            </div>
          )}
          {sub && delta == null && <p className="mt-2 text-xs text-slate-400">{sub}</p>}
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50">
          <Icon className="h-4 w-4 text-slate-400" />
        </div>
      </div>
    </div>
  )
}

export function AnalyticsDashboard({
  monthlyTrend, categoryTotals, storeComparison, topItems,
  totalAllTime, totalThisMonth, totalLastMonth, spendDelta,
  avgReceipt, totalReceipts, countThisMonth, countLastMonth,
}: Props) {
  const totalCategorySpend = categoryTotals.reduce((s, c) => s + c.total, 0)
  const maxMonthly = Math.max(...monthlyTrend.map((m) => m.total), 1)

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-base font-semibold text-slate-900">Analytics</h1>
        <p className="text-xs text-slate-400 mt-0.5">Spending insights across all your receipts</p>
      </div>

      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="All-Time Spend"
          value={`$${totalAllTime.toFixed(2)}`}
          sub={`${totalReceipts} receipt${totalReceipts !== 1 ? 's' : ''}`}
          icon={ReceiptText}
        />
        <KpiCard
          label="This Month"
          value={`$${totalThisMonth.toFixed(2)}`}
          delta={spendDelta == null ? null : `${spendDelta >= 0 ? '+' : ''}${spendDelta.toFixed(1)}% vs last month`}
          positive={spendDelta != null ? spendDelta <= 0 : true}
          icon={TrendingUp}
        />
        <KpiCard
          label="Avg Receipt"
          value={`$${avgReceipt.toFixed(2)}`}
          sub="per processed receipt"
          icon={ShoppingCart}
        />
        <KpiCard
          label="Receipts This Month"
          value={String(countThisMonth)}
          delta={countLastMonth === 0 ? null : `${countThisMonth >= countLastMonth ? '+' : ''}${countThisMonth - countLastMonth} vs last month`}
          positive={countThisMonth <= countLastMonth}
          icon={Store}
        />
      </div>

      {/* Monthly trend — full width */}
      <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Spending Trend</p>
        <h3 className="mt-0.5 text-sm font-semibold text-slate-900">12-month history</h3>
        {monthlyTrend.some((m) => m.total > 0) ? (
          <div className="mt-4">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={monthlyTrend} margin={{ top: 4, right: 0, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} width={44} tickFormatter={(v) => `$${v}`} />
                <Tooltip content={<Tooltip$ />} />
                <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} fill="url(#areaGrad)" dot={false} activeDot={{ r: 4, fill: '#10b981' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[200px] items-center justify-center mt-4">
            <p className="text-xs text-slate-400">No data yet — upload some receipts!</p>
          </div>
        )}
      </div>

      {/* Category + Store row */}
      <div className="grid gap-4 xl:grid-cols-2">
        {/* Category breakdown */}
        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Categories</p>
          <h3 className="mt-0.5 text-sm font-semibold text-slate-900">All-time spend by category</h3>
          {categoryTotals.length > 0 ? (
            <div className="mt-4 space-y-2.5">
              {categoryTotals.slice(0, 8).map((c, i) => (
                <div key={c.category}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-xs text-slate-700 font-medium">{c.category}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">
                        {totalCategorySpend > 0 ? `${Math.round((c.total / totalCategorySpend) * 100)}%` : '—'}
                      </span>
                      <span className="text-xs font-semibold text-slate-800 w-16 text-right">${c.total.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${totalCategorySpend > 0 ? (c.total / totalCategorySpend) * 100 : 0}%`,
                        backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-[180px] items-center justify-center mt-4">
              <p className="text-xs text-slate-400">No category data yet</p>
            </div>
          )}
        </div>

        {/* Store comparison */}
        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Stores</p>
          <h3 className="mt-0.5 text-sm font-semibold text-slate-900">Top stores this month</h3>
          {storeComparison.length > 0 ? (
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={Math.min(60 + storeComparison.length * 36, 260)}>
                <BarChart data={storeComparison} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `$${v}`} />
                  <YAxis type="category" dataKey="store" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} width={88} />
                  <Tooltip content={<Tooltip$ />} cursor={{ fill: '#f1f5f9' }} />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]} fill="#0f766e" maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[200px] items-center justify-center mt-4">
              <p className="text-xs text-slate-400">No store data this month</p>
            </div>
          )}
        </div>
      </div>

      {/* Monthly breakdown table + Top items */}
      <div className="grid gap-4 xl:grid-cols-2">
        {/* Monthly breakdown */}
        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Month by Month</p>
          <h3 className="mt-0.5 text-sm font-semibold text-slate-900">Spending breakdown</h3>
          <div className="mt-4 space-y-1">
            {monthlyTrend.slice().reverse().filter((m) => m.total > 0 || m.count > 0).slice(0, 8).map((m) => (
              <div key={m.month} className="flex items-center gap-3 py-1.5 border-b border-slate-50 last:border-0">
                <span className="text-xs text-slate-500 w-16 shrink-0">{m.month}</span>
                <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-teal-500 transition-all"
                    style={{ width: `${maxMonthly > 0 ? (m.total / maxMonthly) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-800 w-16 text-right">${m.total.toFixed(2)}</span>
                <span className="text-[10px] text-slate-400 w-14 text-right">{m.count} receipt{m.count !== 1 ? 's' : ''}</span>
              </div>
            ))}
            {monthlyTrend.every((m) => m.total === 0) && (
              <p className="text-xs text-slate-400 py-8 text-center">No data yet</p>
            )}
          </div>
        </div>

        {/* Top items */}
        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Top Items</p>
          <h3 className="mt-0.5 text-sm font-semibold text-slate-900">Most spent on (all time)</h3>
          {topItems.length > 0 ? (
            <div className="mt-4 space-y-2">
              {topItems.map((item, i) => {
                const maxItem = topItems[0].total
                return (
                  <div key={item.item} className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-slate-300 w-4 shrink-0">{i + 1}</span>
                    <span className="text-xs text-slate-700 flex-1 capitalize truncate">{item.item}</span>
                    <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden shrink-0">
                      <div
                        className="h-full rounded-full bg-teal-500"
                        style={{ width: `${maxItem > 0 ? (item.total / maxItem) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-800 w-14 text-right shrink-0">${item.total.toFixed(2)}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex h-[200px] items-center justify-center mt-4">
              <p className="text-xs text-slate-400">No item data yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
