import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { Navbar } from '@/components/layout/Navbar'
import { ReceiptCard } from '@/components/receipt/ReceiptCard'
import { UploadButton } from '@/components/receipt/UploadButton'
import { DashboardSearch } from '@/components/receipt/DashboardSearch'
import { Button } from '@/components/ui/button'
import { Receipt } from 'lucide-react'

interface Props {
  searchParams: Promise<{ search?: string; page?: string; from?: string; to?: string; status?: string }>
}

export default async function DashboardPage({ searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')

  const params = await searchParams
  const search = params.search ?? ''
  const page = Math.max(1, parseInt(params.page ?? '1'))
  const limit = 12
  const fromDate = params.from ? new Date(params.from) : undefined
  const toDate = params.to ? new Date(params.to) : undefined
  const statusFilter = params.status

  const where = {
    userId: session.user.id,
    ...(search ? { storeName: { contains: search } } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(fromDate || toDate
      ? {
          uploadDate: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: new Date(toDate.getTime() + 86400000) } : {}),
          },
        }
      : {}),
  }

  const [receipts, total] = await Promise.all([
    db.receipt.findMany({
      where,
      orderBy: { uploadDate: 'desc' },
      take: limit,
      skip: (page - 1) * limit,
      include: { _count: { select: { items: true } } },
    }),
    db.receipt.count({ where }),
  ])

  const totalPages = Math.ceil(total / limit)
  const hasFilters = !!(search || params.from || params.to || statusFilter)

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      <main className="flex-1 container py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">My Receipts</h1>
            <p className="text-sm text-muted-foreground">
              {total} receipt{total !== 1 ? 's' : ''}{hasFilters ? ' matching filters' : ' total'}
            </p>
          </div>
          <UploadButton />
        </div>

        {/* Search + filters */}
        <DashboardSearch
          defaultSearch={search}
          defaultFrom={params.from ?? ''}
          defaultTo={params.to ?? ''}
          defaultStatus={statusFilter ?? ''}
        />

        {/* Receipt grid */}
        {receipts.length === 0 ? (
          <EmptyState hasSearch={hasFilters} />
        ) : (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {receipts.map((receipt) => (
                <ReceiptCard key={receipt.id} receipt={receipt} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                {page > 1 && (
                  <Link href={buildPageUrl(params, page - 1)}>
                    <Button variant="outline" size="sm">Previous</Button>
                  </Link>
                )}
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                {page < totalPages && (
                  <Link href={buildPageUrl(params, page + 1)}>
                    <Button variant="outline" size="sm">Next</Button>
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function buildPageUrl(
  params: { search?: string; from?: string; to?: string; status?: string },
  newPage: number,
) {
  const p = new URLSearchParams()
  if (params.search) p.set('search', params.search)
  if (params.from) p.set('from', params.from)
  if (params.to) p.set('to', params.to)
  if (params.status) p.set('status', params.status)
  p.set('page', String(newPage))
  return `/dashboard?${p.toString()}`
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  if (hasSearch) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
          <Receipt className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold">No receipts found</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          Try a different search term or clear the filters.
        </p>
      </div>
    )
  }

  return (
    <div className="py-8">
      <UploadButton variant="zone" />
    </div>
  )
}
