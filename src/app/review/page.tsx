import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { AppShell } from '@/components/layout/AppShell'
import { ReviewQueue } from '@/components/receipt/ReviewQueue'

export default async function ReviewPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')

  const receipts = await db.receipt.findMany({
    where: { userId: session.user.id, status: 'done', reviewStatus: 'needs_review' },
    orderBy: [{ overallConfidence: 'asc' }, { uploadDate: 'desc' }],
    include: {
      items: {
        where: { needsReview: true },
        orderBy: { confidence: 'asc' },
        take: 5,
      },
      _count: { select: { items: true } },
    },
  })

  return (
    <AppShell title="Review Queue">
      <div className="px-4 sm:px-6 py-6 max-w-[1400px]">
        <ReviewQueue receipts={receipts} />
      </div>
    </AppShell>
  )
}
