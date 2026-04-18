import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { toCSV, buildPdfData } from '@/lib/export'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const format = req.nextUrl.searchParams.get('format') ?? 'csv'

  const receipt = await db.receipt.findFirst({
    where: { id, userId: session.user.id },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  })

  if (!receipt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const storeSafe = (receipt.storeName ?? 'receipt').replace(/[^a-z0-9]/gi, '-').toLowerCase()
  const fileName = `${storeSafe}-${id.slice(0, 8)}`

  if (format === 'csv') {
    const csv = toCSV(receipt)
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${fileName}.csv"`,
      },
    })
  }

  if (format === 'pdf') {
    // Return JSON that client-side jsPDF will use to render
    return NextResponse.json({ ok: true, data: buildPdfData(receipt), fileName })
  }

  return NextResponse.json({ error: 'Unsupported format' }, { status: 400 })
}
