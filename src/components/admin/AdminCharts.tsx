'use client'

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { format, parseISO } from 'date-fns'

interface UploadsChartProps {
  data: { date: string; count: number }[]
}

export function UploadsChart({ data }: UploadsChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    label: format(parseISO(d.date), 'MMM d'),
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={formatted} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="uploadGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(142 71% 35%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(142 71% 35%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(value: number) => [value, 'Uploads']}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="hsl(142 71% 35%)"
          strokeWidth={2}
          fill="url(#uploadGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

interface TopStoresChartProps {
  data: { storeName: string; count: number }[]
}

export function TopStoresChart({ data }: TopStoresChartProps) {
  const truncated = data.map((d) => ({
    ...d,
    label: d.storeName.length > 16 ? d.storeName.slice(0, 16) + '…' : d.storeName,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={truncated} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={100} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
          formatter={(value: number) => [value, 'Receipts']}
        />
        <Bar dataKey="count" fill="hsl(142 71% 35%)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
