'use client'

import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ShoppingCart, CheckCircle2, XCircle, Loader2, Mail, ArrowRight } from 'lucide-react'
import toast from 'react-hot-toast'

type State = 'loading' | 'success' | 'expired' | 'invalid'

export default function VerifyEmailPage() {
  const params = useSearchParams()
  const router = useRouter()
  const [state, setState] = useState<State>('loading')
  const [resending, setResending] = useState(false)
  const calledRef = useRef(false)

  const email = params.get('email') ?? ''
  const token = params.get('token') ?? ''

  useEffect(() => {
    if (calledRef.current) return
    calledRef.current = true

    if (!email || !token) {
      setState('invalid')
      return
    }

    fetch(`/api/auth/verify-email?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (res.ok) {
          setState('success')
          setTimeout(() => router.push('/dashboard'), 2500)
        } else {
          const body = await res.json().catch(() => ({})) as { error?: string }
          if (res.status === 410) setState('expired')
          else setState('invalid')
          if (body.error) console.warn('[verify-email]', body.error)
        }
      })
      .catch(() => setState('invalid'))
  }, [email, token, router])

  async function handleResend() {
    if (!email) return
    setResending(true)
    const res = await fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setResending(false)
    if (res.ok) toast.success('Verification email sent! Check your inbox.')
    else toast.error('Failed to resend. Please try again.')
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-teal-50 via-white to-emerald-50/60 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/30" />
      <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-teal-200/30 dark:bg-teal-900/20 blur-3xl animate-float" />
      <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-emerald-200/30 dark:bg-emerald-900/20 blur-3xl animate-float" style={{ animationDelay: '2s' }} />

      <div className="relative z-10 w-full max-w-sm animate-slide-up">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="relative">
            <div className="absolute inset-0 rounded-2xl bg-teal-500/30 blur-lg animate-pulse-glow" />
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-lg">
              <ShoppingCart className="h-7 w-7 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight gradient-text">AisleIQ</h1>
        </div>

        <div className="glass shadow-2xl rounded-2xl p-8 flex flex-col items-center gap-5 text-center">
          {state === 'loading' && (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-950/40">
                <Loader2 className="h-8 w-8 text-teal-600 animate-spin" />
              </div>
              <div>
                <p className="font-bold text-lg text-slate-900 dark:text-slate-100">Verifying your email…</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Just a moment</p>
              </div>
            </>
          )}

          {state === 'success' && (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/40">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-lg text-slate-900 dark:text-slate-100">Email verified!</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Your account is now active. Redirecting to your dashboard…
                </p>
              </div>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all glow-teal-sm"
              >
                Go to Dashboard <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          )}

          {(state === 'expired' || state === 'invalid') && (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-950/40">
                <XCircle className="h-8 w-8 text-rose-500" />
              </div>
              <div>
                <p className="font-bold text-lg text-slate-900 dark:text-slate-100">
                  {state === 'expired' ? 'Link expired' : 'Invalid link'}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {state === 'expired'
                    ? 'This verification link has expired. Request a new one below.'
                    : 'This verification link is invalid or already used.'}
                </p>
              </div>
              {email && (
                <button
                  onClick={handleResend}
                  disabled={resending}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:transform-none glow-teal-sm"
                >
                  {resending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Resend verification email
                </button>
              )}
              <Link href="/signin" className="text-sm text-teal-600 hover:text-teal-700 dark:text-teal-400 hover:underline transition-colors">
                Back to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
