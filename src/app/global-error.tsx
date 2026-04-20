'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global-error]', error)
  }, [error])

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 font-sans antialiased">
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="max-w-sm space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50">
              <AlertTriangle className="h-6 w-6 text-rose-500" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Something went wrong</h1>
              <p className="mt-1 text-sm text-slate-500">
                An unexpected error occurred. Try refreshing the page.
              </p>
            </div>
            <Button onClick={reset} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
          </div>
        </div>
      </body>
    </html>
  )
}
