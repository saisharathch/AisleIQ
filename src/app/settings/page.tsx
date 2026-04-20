import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { getGoogleSheetsOwnerEmail } from '@/lib/env'
import { AppShell } from '@/components/layout/AppShell'
import { SettingsForm } from '@/components/settings/SettingsForm'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')
  const sheetsOwnerEmail = getGoogleSheetsOwnerEmail()

  const [user, categoryPrefs, account, sheetsOwner, sheetsOwnerAccount] = await Promise.all([
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
    sheetsOwnerEmail
      ? db.user.findUnique({
          where: { email: sheetsOwnerEmail },
          select: { email: true, sheetsSpreadsheetId: true },
        })
      : Promise.resolve(null),
    sheetsOwnerEmail
      ? db.user.findUnique({
          where: { email: sheetsOwnerEmail },
          select: {
            accounts: {
              where: { provider: 'google' },
              select: { scope: true },
              take: 1,
            },
          },
        })
      : Promise.resolve(null),
  ])

  const isSheetsOwner = !sheetsOwnerEmail || user?.email?.toLowerCase() === sheetsOwnerEmail
  const sheetsConnected = isSheetsOwner
    ? !!account?.scope?.includes('spreadsheets')
    : !!sheetsOwnerAccount?.accounts?.[0]?.scope?.includes('spreadsheets')
  const spreadsheetId = isSheetsOwner
    ? user?.sheetsSpreadsheetId ?? null
    : sheetsOwner?.sheetsSpreadsheetId ?? null

  return (
    <AppShell title="Settings">
      <div className="px-4 sm:px-6 py-6 max-w-[800px]">
        <SettingsForm
          name={user?.name ?? ''}
          email={user?.email ?? ''}
          spreadsheetId={spreadsheetId}
          sheetsConnected={sheetsConnected}
          sheetsOwnerEmail={sheetsOwnerEmail}
          isSheetsOwner={isSheetsOwner}
          memberSince={user?.createdAt?.toISOString() ?? null}
          categoryPrefs={categoryPrefs}
        />
      </div>
    </AppShell>
  )
}
