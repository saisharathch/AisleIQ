import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { Navbar } from '@/components/layout/Navbar'
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
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 container py-8">
        <ReceiptDetailView receipt={receipt} />
      </main>
    </div>
  )
}
