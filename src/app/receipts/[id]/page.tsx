import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { AppShell } from '@/components/layout/AppShell'
import { ReceiptDetailView } from '@/components/receipt/ReceiptDetailView'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ReceiptDetailPage({ params }: Props) {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')

  const { id } = await params

  const receipt = await db.receipt.findFirst({
    where: { id, userId: session.user.id },
    include: {
      items: { orderBy: { sortOrder: 'asc' } },
      editLogs: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { user: { select: { name: true, email: true } } },
      },
    },
  })

  if (!receipt) notFound()

  return (
    <AppShell title={receipt.storeName ?? 'Receipt Detail'}>
      <div className="px-4 sm:px-6 py-6">
        <ReceiptDetailView receipt={receipt} />
      </div>
    </AppShell>
  )
}
