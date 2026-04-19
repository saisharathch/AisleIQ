import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AppShell } from '@/components/layout/AppShell'
import { AIAssistant } from '@/components/assistant/AIAssistant'

export default async function AssistantPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/signin')

  return (
    <AppShell title="AI Assistant">
      {/* Fill the full remaining height so the chat layout works */}
      <div className="h-[calc(100vh-3.5rem)]">
        <AIAssistant />
      </div>
    </AppShell>
  )
}
