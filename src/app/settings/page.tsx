import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { AppShell } from '@/components/layout/AppShell'
import { SettingsForm } from '@/components/settings/SettingsForm'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')

  const [user, categoryPrefs, account] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true, sheetsSpreadsheetId: true, createdAt: true },
    }),
    db.categoryPreference.findMany({
      where: { userId: session.user.id },
      orderBy: { usageCount: 'desc' },
      take: 20,
    }),
    db.account.findFirst({
      where: { userId: session.user.id, provider: 'google' },
      select: { scope: true, expires_at: true },
    }),
  ])

  const sheetsConnected = !!account?.scope?.includes('spreadsheets')

  return (
    <AppShell title="Settings">
      <div className="px-4 sm:px-6 py-6 max-w-[800px]">
        <SettingsForm
          name={user?.name ?? ''}
          email={user?.email ?? ''}
          spreadsheetId={user?.sheetsSpreadsheetId ?? null}
          sheetsConnected={sheetsConnected}
          memberSince={user?.createdAt?.toISOString() ?? null}
          categoryPrefs={categoryPrefs}
        />
      </div>
    </AppShell>
  )
}
