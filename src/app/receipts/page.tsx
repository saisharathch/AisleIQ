import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { AppShell } from '@/components/layout/AppShell'
import { UploadButton } from '@/components/receipt/UploadButton'
import { ReceiptInbox } from '@/components/receipt/ReceiptInbox'

interface Props {
  searchParams: Promise<{
    search?: string; page?: string; from?: string; to?: string
    status?: string; review?: string; sort?: string
    minAmount?: string; maxAmount?: string
  }>
}

type SortOption = 'newest' | 'oldest' | 'amount-desc' | 'amount-asc' | 'store'

const ORDER_BY: Record<SortOption, object> = {
  newest:      { uploadDate: 'desc' },
  oldest:      { uploadDate: 'asc' },
  'amount-desc': { grandTotal: 'desc' },
  'amount-asc':  { grandTotal: 'asc' },
  store:       { storeName: 'asc' },
}

export default async function ReceiptsPage({ searchParams }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')

  const params      = await searchParams
  const search      = params.search ?? ''
  const page        = Math.max(1, parseInt(params.page ?? '1'))
  const limit       = 20
  const fromDate    = params.from ? new Date(params.from) : undefined
  const toDate      = params.to   ? new Date(params.to)   : undefined
  const statusFilter = params.status ?? ''
  const reviewFilter = params.review ?? ''
  const sort        = (params.sort ?? 'newest') as SortOption
  const minAmount   = params.minAmount ? parseFloat(params.minAmount) : undefined
  const maxAmount   = params.maxAmount ? parseFloat(params.maxAmount) : undefined

  const where = {
    userId: session.user.id,
    ...(search        ? { storeName: { contains: search } } : {}),
    ...(statusFilter  ? { status: statusFilter }            : {}),
    ...(reviewFilter  ? { reviewStatus: reviewFilter }      : {}),
    ...((fromDate || toDate) ? {
      uploadDate: {
        ...(fromDate ? { gte: fromDate } : {}),
        ...(toDate   ? { lte: new Date(toDate.getTime() + 86_400_000) } : {}),
      },
    } : {}),
    ...((minAmount != null || maxAmount != null) ? {
      grandTotal: {
        ...(minAmount != null ? { gte: minAmount } : {}),
        ...(maxAmount != null ? { lte: maxAmount } : {}),
      },
    } : {}),
  }

  const orderBy = ORDER_BY[sort] ?? ORDER_BY.newest

  const [receipts, total, counts] = await Promise.all([
    db.receipt.findMany({
      where,
      orderBy,
      take: limit,
      skip: (page - 1) * limit,
      include: { _count: { select: { items: true } } },
    }),
    db.receipt.count({ where }),
    db.receipt.groupBy({
      by: ['status', 'reviewStatus'],
      where: { userId: session.user.id },
      _count: true,
    }),
  ])

  const statusCounts = {
    all:         await db.receipt.count({ where: { userId: session.user.id } }),
    needsReview: counts.filter(c => c.status === 'done' && c.reviewStatus === 'needs_review').reduce((s, c) => s + c._count, 0),
    approved:    counts.filter(c => c.reviewStatus === 'approved').reduce((s, c) => s + c._count, 0),
    failed:      counts.filter(c => c.status === 'failed').reduce((s, c) => s + c._count, 0),
    processing:  counts.filter(c => c.status === 'processing' || c.status === 'queued').reduce((s, c) => s + c._count, 0),
    synced:      counts.filter(c => (c as { syncStatus?: string }).syncStatus === 'synced').reduce((s, c) => s + c._count, 0),
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <AppShell title="Receipts" actions={<UploadButton />}>
      <div className="px-4 sm:px-6 py-6 max-w-[1400px]">
        <ReceiptInbox
          rows={receipts}
          total={total}
          totalPages={totalPages}
          page={page}
          statusCounts={statusCounts}
          search={search}
          from={params.from ?? ''}
          to={params.to ?? ''}
          statusFilter={statusFilter}
          reviewFilter={reviewFilter}
          sort={sort}
          minAmount={params.minAmount ?? ''}
          maxAmount={params.maxAmount ?? ''}
        />
      </div>
    </AppShell>
  )
}
