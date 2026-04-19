import Link from 'next/link'
import { FileQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="text-center space-y-4 max-w-sm">
        <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
          <FileQuestion className="h-6 w-6 text-slate-400" />
        </div>
        <div>
          <p className="text-5xl font-bold text-slate-200 mb-2">404</p>
          <h1 className="text-lg font-semibold text-slate-900">Page not found</h1>
          <p className="text-sm text-slate-500 mt-1">
            The page you&apos;re looking for doesn&apos;t exist.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
