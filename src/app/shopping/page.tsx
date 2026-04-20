import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AppShell } from '@/components/layout/AppShell'
import { ShoppingList } from '@/components/shopping/ShoppingList'

export default async function ShoppingPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')

  return (
    <AppShell title="Shopping List">
      <div className="px-4 sm:px-6 py-6 max-w-[800px]">
        <ShoppingList />
      </div>
    </AppShell>
  )
}
