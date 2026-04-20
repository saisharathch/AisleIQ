'use client'

import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts'
import {
  ArrowDownRight, ArrowUpRight, ReceiptText, Store,
  TrendingUp, ClipboardCheck, ShoppingCart, BarChart2,
} from 'lucide-react'

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

const ICON_MAP = {
  spend: ReceiptText,
  review: ClipboardCheck,
  store: Store,
  trend: TrendingUp,
  receipts: ShoppingCart,
}

const ICON_STYLE: Record<MetricCard['icon'], { bg: string; text: string; glow: string }> = {
  spend:    { bg: 'bg-gradient-to-br from-teal-100 to-teal-50 dark:from-teal-900/40 dark:to-teal-950/20',    text: 'text-teal-600 dark:text-teal-400',    glow: '' },
  receipts: { bg: 'bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-950/20',   text: 'text-blue-600 dark:text-blue-400',    glow: '' },
  review:   { bg: 'bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/40 dark:to-amber-950/20', text: 'text-amber-600 dark:text-amber-400', glow: '' },
  store:    { bg: 'bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/40 dark:to-purple-950/20', text: 'text-purple-600 dark:text-purple-400', glow: '' },
  trend:    { bg: 'bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/40 dark:to-emerald-950/20', text: 'text-emerald-600 dark:text-emerald-400', glow: '' },
}

// ─── Custom tooltip ────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 shadow-2xl text-xs animate-scale-in">
      <p className="font-medium text-slate-300 mb-1">{label}</p>
      <p className="text-teal-400 font-bold text-sm">${payload[0].value.toFixed(2)}</p>
    </div>
  )
}

// ─── KPI cards ─────────────────────────────────────────────────────────────
function KpiCards({ cards }: { cards: MetricCard[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card, i) => {
        const Icon = ICON_MAP[card.icon]
        const style = ICON_STYLE[card.icon]
        return (
          <div
            key={card.label}
            className="group relative rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden animate-slide-up cursor-default"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {/* Subtle corner gradient */}
            <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-gradient-to-br from-teal-500/5 to-transparent -translate-y-8 translate-x-8 group-hover:scale-150 transition-transform duration-500" />

            <div className="flex items-start justify-between gap-2 relative">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
                  {card.label}
                </p>
                <p className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-none truncate">
                  {card.value}
                </p>
                {card.delta && (
                  <div className={`mt-2.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    card.positive
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                  }`}>
                    {card.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {card.delta}
                  </div>
                )}
                {card.sub && !card.delta && (
                  <p className="mt-2 text-xs text-slate-400">{card.sub}</p>
                )}
              </div>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.bg} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                <Icon className={`h-5 w-5 ${style.text}`} />
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
      <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
        <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center animate-float">
          <Store className="h-5 w-5 text-slate-300 dark:text-slate-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-400">No store data yet</p>
          <p className="text-xs text-slate-300 dark:text-slate-600 mt-0.5">Upload approved receipts to see breakdown</p>
        </div>
      </div>
    )
  }
  if (data.length === 1) {
    return (
      <div className="flex items-center gap-4 rounded-xl bg-gradient-to-r from-teal-50 to-emerald-50/50 dark:from-teal-950/30 dark:to-emerald-950/20 border border-teal-100 dark:border-teal-900/40 px-4 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-100 to-teal-50 dark:from-teal-900/50 dark:to-teal-950/30 shrink-0 shadow-sm">
          <Store className="h-4 w-4 text-teal-700 dark:text-teal-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">{data[0].store}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">Only store this month</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-bold text-teal-700 dark:text-teal-400">${data[0].total.toFixed(2)}</p>
          <p className="text-[10px] text-slate-400">total</p>
        </div>
      </div>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={Math.min(48 + data.length * 38, 200)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0f766e" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>
        <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `$${v}`} />
        <YAxis type="category" dataKey="store" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#64748b' }} width={80} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(20,184,166,0.05)' }} />
        <Bar dataKey="total" radius={[0, 6, 6, 0]} fill="url(#barGrad)" maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Empty chart state ─────────────────────────────────────────────────────
function ChartEmpty({ icon: Icon, message, sub }: { icon: React.ComponentType<{ className?: string }>; message: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-6">
      <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center animate-float">
        <Icon className="h-5 w-5 text-slate-300 dark:text-slate-600" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-400">{message}</p>
        {sub && <p className="text-xs text-slate-300 dark:text-slate-600 mt-0.5">{sub}</p>}
      </div>
    </div>
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
        <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Monthly Spend</p>
              <h3 className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">6-month trend</h3>
            </div>
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-teal-100 to-teal-50 dark:from-teal-900/40 dark:to-teal-950/20 flex items-center justify-center">
              <TrendingUp className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
            </div>
          </div>
          {hasSpend ? (
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={168}>
                <AreaChart data={monthlyTrend} margin={{ top: 4, right: 0, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="60%" stopColor="#10b981" stopOpacity={0.05} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="rgba(148,163,184,0.15)" />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} width={40} tickFormatter={(v) => `$${v}`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fill="url(#trendGrad)"
                    dot={false}
                    activeDot={{ r: 5, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[168px] mt-4">
              <ChartEmpty icon={TrendingUp} message="No spend data yet" sub="Upload receipts to see your trend" />
            </div>
          )}
        </div>

        {/* Category mix */}
        <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Categories</p>
              <h3 className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">Where money goes</h3>
            </div>
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-100 to-purple-50 dark:from-purple-900/40 dark:to-purple-950/20 flex items-center justify-center">
              <BarChart2 className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          {hasCategory ? (
            <div className="mt-4 flex items-center gap-4">
              <div className="shrink-0">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie
                      data={categoryTotals}
                      dataKey="total"
                      innerRadius={34}
                      outerRadius={54}
                      paddingAngle={3}
                      startAngle={90}
                      endAngle={-270}
                      isAnimationActive
                      animationBegin={200}
                      animationDuration={800}
                    >
                      {categoryTotals.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => [`$${v.toFixed(2)}`, '']}
                      contentStyle={{
                        borderRadius: 10,
                        fontSize: 11,
                        border: '1px solid #334155',
                        background: '#0f172a',
                        color: '#f1f5f9',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2 min-w-0">
                {categoryTotals.slice(0, 5).map((c, i) => (
                  <div key={c.category} className="flex items-center gap-2 text-xs group/cat">
                    <span className="h-2 w-2 rounded-full shrink-0 transition-transform group-hover/cat:scale-125" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="flex-1 truncate text-slate-600 dark:text-slate-400">{c.category}</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 shrink-0 tabular-nums">
                      {totalCategorySpend > 0 ? `${Math.round((c.total / totalCategorySpend) * 100)}%` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-[140px] mt-4">
              <ChartEmpty icon={BarChart2} message="No category data yet" />
            </div>
          )}
        </div>
      </div>

      {/* Store comparison */}
      <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Stores</p>
            <h3 className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">Top stores this month</h3>
          </div>
          <div className="flex items-center gap-2">
            {storeComparison.length > 1 && (
              <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {storeComparison.length} stores
              </span>
            )}
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/40 dark:to-blue-950/20 flex items-center justify-center">
              <Store className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>
        <StoreSection data={storeComparison} />
      </div>
    </section>
  )
}
