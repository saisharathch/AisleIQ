'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw, LayoutDashboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[dashboard-error]', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="mx-auto h-12 w-12 rounded-full bg-rose-50 flex items-center justify-center">
          <AlertTriangle className="h-6 w-6 text-rose-500" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Dashboard failed to load</h1>
          <p className="text-sm text-slate-500 mt-1">
            Could not load your receipts. This is usually a temporary issue.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2">
          <Button onClick={reset} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
          <Button asChild className="gap-2">
            <Link href="/dashboard">
              <LayoutDashboard className="h-4 w-4" /> Reload
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
