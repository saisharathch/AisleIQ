'use client'

import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts'
import { ArrowDownRight, ArrowUpRight, ReceiptText, Store, TrendingUp, ClipboardCheck, ShoppingCart } from 'lucide-react'

interface MetricCard {
  label: string
  value: string
  delta?: string
  positive?: boolean
  sub?: string
  icon: 'spend' | 'review' | 'store' | 'trend' | 'receipts'
}

interface Props {
  metricCards: MetricCard[]
  monthlyTrend: { month: string; total: number }[]
  categoryTotals: { category: string; total: number }[]
  storeComparison: { store: string; total: number }[]
}

const PIE_COLORS = ['#0f766e', '#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ef4444']
const ICON_MAP = { spend: ReceiptText, review: ClipboardCheck, store: Store, trend: TrendingUp, receipts: ShoppingCart }

// ─── Custom tooltip ────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-medium text-slate-700 mb-1">{label}</p>
      <p className="text-teal-700 font-semibold">${payload[0].value.toFixed(2)}</p>
    </div>
  )
}

// ─── KPI cards ─────────────────────────────────────────────────────────────
function KpiCards({ cards }: { cards: MetricCard[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = ICON_MAP[card.icon]
        const isAlert = card.icon === 'review' && card.value !== '0'
        return (
          <div
            key={card.label}
            className={`rounded-xl border bg-white p-5 shadow-sm hover:shadow-md transition-shadow ${
              isAlert ? 'border-amber-100' : 'border-slate-100'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
                  {card.label}
                </p>
                <p className="text-3xl font-bold tracking-tight text-slate-900 leading-none truncate">
                  {card.value}
                </p>
                {card.delta && (
                  <div className={`mt-2.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    card.positive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}>
                    {card.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {card.delta}
                  </div>
                )}
                {card.sub && !card.delta && (
                  <p className="mt-2 text-xs text-slate-400">{card.sub}</p>
                )}
              </div>
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                isAlert ? 'bg-amber-50' : 'bg-slate-50'
              }`}>
                <Icon className={`h-4.5 w-4.5 ${isAlert ? 'text-amber-500' : 'text-slate-400'}`} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Store comparison ──────────────────────────────────────────────────────
function StoreSection({ data }: { data: Props['storeComparison'] }) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
        <Store className="h-7 w-7 text-slate-200" />
        <p className="text-xs text-slate-400">No store data yet this month</p>
      </div>
    )
  }
  if (data.length === 1) {
    return (
      <div className="flex items-center gap-4 rounded-xl bg-teal-50/70 border border-teal-100 px-4 py-3.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-100 shrink-0">
          <Store className="h-4 w-4 text-teal-700" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-slate-900 truncate">{data[0].store}</p>
          <p className="text-xs text-slate-500">Only store this month</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-bold text-teal-700">${data[0].total.toFixed(2)}</p>
          <p className="text-[10px] text-slate-400">total</p>
        </div>
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={Math.min(48 + data.length * 38, 200)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
        <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `$${v}`} />
        <YAxis type="category" dataKey="store" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} width={80} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
        <Bar dataKey="total" radius={[0, 4, 4, 0]} fill="#0f766e" maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Main export ───────────────────────────────────────────────────────────
export function DashboardInsights({ metricCards, monthlyTrend, categoryTotals, storeComparison }: Props) {
  const hasSpend = monthlyTrend.some((m) => m.total > 0)
  const hasCategory = categoryTotals.length > 0
  const totalCategorySpend = categoryTotals.reduce((s, c) => s + c.total, 0)

  return (
    <section className="space-y-4">
      <KpiCards cards={metricCards} />

      {/* Charts row */}
      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        {/* Trend */}
        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Monthly Spend</p>
          <h3 className="mt-0.5 text-sm font-semibold text-slate-900">6-month trend</h3>
          {hasSpend ? (
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={168}>
                <AreaChart data={monthlyTrend} margin={{ top: 4, right: 0, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} width={40} tickFormatter={(v) => `$${v}`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="total" stroke="#10b981" strokeWidth={2} fill="url(#trendGrad)" dot={false} activeDot={{ r: 4, fill: '#10b981' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-[168px] items-center justify-center mt-4">
              <p className="text-xs text-slate-400">Upload receipts to see your trend</p>
            </div>
          )}
        </div>

        {/* Category mix */}
        <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Categories</p>
          <h3 className="mt-0.5 text-sm font-semibold text-slate-900">Where money goes</h3>
          {hasCategory ? (
            <div className="mt-4 flex items-center gap-4">
              <div className="shrink-0">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie data={categoryTotals} dataKey="total" innerRadius={36} outerRadius={56} paddingAngle={2} startAngle={90} endAngle={-270}>
                      {categoryTotals.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, '']} contentStyle={{ borderRadius: 8, fontSize: 11, border: '1px solid #e2e8f0' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                {categoryTotals.slice(0, 5).map((c, i) => (
                  <div key={c.category} className="flex items-center gap-2 text-xs">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="flex-1 truncate text-slate-600">{c.category}</span>
                    <span className="font-semibold text-slate-800 shrink-0">
                      {totalCategorySpend > 0 ? `${Math.round((c.total / totalCategorySpend) * 100)}%` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex h-[140px] items-center justify-center mt-4">
              <p className="text-xs text-slate-400">No category data yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Store comparison */}
      <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Stores</p>
            <h3 className="mt-0.5 text-sm font-semibold text-slate-900">Top stores this month</h3>
          </div>
          {storeComparison.length > 1 && (
            <p className="text-xs text-slate-400">{storeComparison.length} stores</p>
          )}
        </div>
        <StoreSection data={storeComparison} />
      </div>
    </section>
  )
}
