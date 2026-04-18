'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition, useCallback, useState } from 'react'
import { Search, X, SlidersHorizontal } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface Props {
  defaultSearch?: string
  defaultFrom?: string
  defaultTo?: string
  defaultStatus?: string
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'done', label: 'Processed' },
  { value: 'processing', label: 'Processing' },
  { value: 'failed', label: 'Failed' },
]

export function DashboardSearch({ defaultSearch = '', defaultFrom = '', defaultTo = '', defaultStatus = '' }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [showFilters, setShowFilters] = useState(!!(defaultFrom || defaultTo || defaultStatus))

  const applyFilters = useCallback(
    (overrides: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString())
      const updates = {
        search: defaultSearch,
        from: defaultFrom,
        to: defaultTo,
        status: defaultStatus,
        ...overrides,
      }
      Object.entries(updates).forEach(([k, v]) => {
        if (v) params.set(k, v)
        else params.delete(k)
      })
      params.set('page', '1')
      startTransition(() => router.push(`/dashboard?${params.toString()}`))
    },
    [router, searchParams, defaultSearch, defaultFrom, defaultTo, defaultStatus],
  )

  const clearAll = useCallback(() => {
    startTransition(() => router.push('/dashboard'))
  }, [router])

  const hasAnyFilter = !!(defaultSearch || defaultFrom || defaultTo || defaultStatus)

  return (
    <div className="space-y-3">
      {/* Primary search row */}
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            defaultValue={defaultSearch}
            placeholder="Search by store name…"
            className="pl-9"
            onChange={(e) => applyFilters({ search: e.target.value })}
          />
        </div>

        <Button
          variant={showFilters ? 'default' : 'outline'}
          size="sm"
          className="gap-2 shrink-0"
          onClick={() => setShowFilters((v) => !v)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {(defaultFrom || defaultTo || defaultStatus) && (
            <span className="ml-1 h-4 w-4 rounded-full bg-primary-foreground text-primary text-[10px] flex items-center justify-center font-bold">
              {[defaultFrom, defaultTo, defaultStatus].filter(Boolean).length}
            </span>
          )}
        </Button>

        {hasAnyFilter && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="gap-1 text-muted-foreground">
            <X className="h-4 w-4" /> Clear
          </Button>
        )}
      </div>

      {/* Expanded filters */}
      {showFilters && (
        <div className="grid sm:grid-cols-3 gap-4 p-4 rounded-lg border bg-muted/30">
          <div className="space-y-1.5">
            <Label className="text-xs">From date</Label>
            <Input
              type="date"
              defaultValue={defaultFrom}
              className="text-sm"
              onChange={(e) => applyFilters({ from: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">To date</Label>
            <Input
              type="date"
              defaultValue={defaultTo}
              className="text-sm"
              onChange={(e) => applyFilters({ to: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Status</Label>
            <select
              defaultValue={defaultStatus}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onChange={(e) => applyFilters({ status: e.target.value })}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  )
}
