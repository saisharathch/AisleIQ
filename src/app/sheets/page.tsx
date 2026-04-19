import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { AppShell } from '@/components/layout/AppShell'
import { SheetsSyncCenter } from '@/components/sheets/SheetsSyncCenter'

export default async function SheetsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')

  const userId = session.user.id

  const [user, syncStats, recentlySynced] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { sheetsSpreadsheetId: true },
    }),
    db.receipt.groupBy({
      by: ['syncStatus'],
      where: { userId },
      _count: true,
    }),
    db.receipt.findMany({
      where: { userId, syncStatus: 'synced' },
      orderBy: { sheetsSyncedAt: 'desc' },
      take: 10,
      select: { id: true, storeName: true, grandTotal: true, sheetsSyncedAt: true, sheetsUploadId: true },
    }),
  ])

  const syncCounts = {
    synced:    syncStats.find((s) => s.syncStatus === 'synced')?._count ?? 0,
    notSynced: syncStats.find((s) => s.syncStatus === 'not_synced')?._count ?? 0,
    failed:    syncStats.find((s) => s.syncStatus === 'failed')?._count ?? 0,
    stale:     syncStats.find((s) => s.syncStatus === 'stale')?._count ?? 0,
  }

  return (
    <AppShell title="Google Sheets">
      <div className="px-4 sm:px-6 py-6 max-w-[1400px]">
        <SheetsSyncCenter
          spreadsheetId={user?.sheetsSpreadsheetId ?? null}
          syncCounts={syncCounts}
          recentlySynced={recentlySynced}
        />
      </div>
    </AppShell>
  )
}
