import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { ShoppingCart, UserPlus, ArrowRight, Clock } from 'lucide-react'

interface Props {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params

  const invite = await db.invite.findUnique({
    where: { token },
    include: { inviter: { select: { name: true, email: true } } },
  })

  if (!invite) notFound()

  const expired = invite.expiresAt < new Date()
  const accepted = !!invite.acceptedAt

  const inviterDisplay = invite.inviter.name ?? invite.inviter.email ?? 'Someone'
  const signUpUrl = `/signup?email=${encodeURIComponent(invite.email)}&invite=${token}`

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-teal-50 via-white to-emerald-50/60 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/30" />
      <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-teal-200/30 dark:bg-teal-900/20 blur-3xl" style={{ animation: 'float 4s ease-in-out infinite' }} />
      <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-emerald-200/30 dark:bg-emerald-900/20 blur-3xl" style={{ animation: 'float 4s ease-in-out infinite', animationDelay: '2s' }} />

      <div className="relative z-10 w-full max-w-sm" style={{ animation: 'slideUp 0.4s cubic-bezier(0.16,1,0.3,1) both' }}>
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl blur-lg" style={{ background: 'rgba(20,184,166,0.3)', animation: 'pulseGlow 2s ease-in-out infinite' }} />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg" style={{ background: 'linear-gradient(135deg, #14b8a6, #059669)' }}>
              <ShoppingCart className="h-7 w-7 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight" style={{ background: 'linear-gradient(135deg, #0d9488, #059669)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            AisleIQ
          </h1>
        </div>

        <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border border-white/50 dark:border-slate-700/40 shadow-2xl rounded-2xl p-8 flex flex-col items-center gap-5 text-center">
          {accepted ? (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 dark:bg-slate-800">
                <UserPlus className="h-7 w-7 text-slate-400" />
              </div>
              <div>
                <p className="font-bold text-lg text-slate-900 dark:text-slate-100">Invite already used</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  This invite link has already been accepted.
                </p>
              </div>
              <Link href="/signin" className="text-sm text-teal-600 hover:underline dark:text-teal-400">
                Sign in instead
              </Link>
            </>
          ) : expired ? (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/30">
                <Clock className="h-7 w-7 text-amber-500" />
              </div>
              <div>
                <p className="font-bold text-lg text-slate-900 dark:text-slate-100">Invite expired</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  This invite from <strong>{inviterDisplay}</strong> has expired. Ask them to send a new one.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-950/40">
                <UserPlus className="h-7 w-7 text-teal-600" />
              </div>
              <div>
                <p className="font-bold text-xl text-slate-900 dark:text-slate-100">You&apos;re invited!</p>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                  <strong className="text-slate-800 dark:text-slate-200">{inviterDisplay}</strong> has invited you to join{' '}
                  <strong className="text-teal-700 dark:text-teal-400">AisleIQ</strong> — the smart grocery receipt tracker that helps you spend better.
                </p>
              </div>
              <div className="w-full space-y-2">
                <p className="text-xs text-slate-400">Joining as</p>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 rounded-xl px-4 py-2.5">
                  {invite.email}
                </p>
              </div>
              <Link
                href={signUpUrl}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                style={{ background: 'linear-gradient(135deg, #0d9488, #059669)', boxShadow: '0 0 12px rgba(20,184,166,0.2)' }}
              >
                Accept invitation <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="text-xs text-slate-400">
                Expires {invite.expiresAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
