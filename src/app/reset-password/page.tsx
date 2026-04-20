'use client'

import { Suspense, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { ShoppingCart, Loader2, Lock, CheckCircle2, ArrowRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({
  password: z
    .string()
    .min(8, 'Min. 8 characters')
    .regex(/[A-Z]/, 'Must contain an uppercase letter')
    .regex(/[0-9]/, 'Must contain a number'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: "Passwords don't match",
  path: ['confirm'],
})

type FormInput = z.infer<typeof schema>

function ResetPasswordForm() {
  const params = useSearchParams()
  const router = useRouter()
  const [done, setDone] = useState(false)

  const email = params.get('email') ?? ''
  const token = params.get('token') ?? ''

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormInput) {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, token, password: data.password }),
    })

    const json = await res.json().catch(() => ({})) as { error?: string }

    if (!res.ok) {
      toast.error(json.error ?? 'Failed to reset password')
      if (res.status === 410 || res.status === 400) {
        setTimeout(() => router.push('/forgot-password'), 2000)
      }
      return
    }

    setDone(true)
    toast.success('Password updated!')
    setTimeout(() => router.push('/signin'), 2500)
  }

  if (!email || !token) {
    return (
      <div className="relative z-10 glass shadow-2xl rounded-2xl p-8 max-w-sm w-full text-center">
        <p className="font-semibold text-slate-900 dark:text-slate-100">Invalid reset link.</p>
        <Link href="/forgot-password" className="mt-3 inline-block text-sm text-teal-600 hover:underline">
          Request a new one
        </Link>
      </div>
    )
  }

  return (
    <div className="relative z-10 w-full max-w-sm animate-slide-up">
      <div className="flex flex-col items-center gap-3 mb-8">
        <div className="relative">
          <div className="absolute inset-0 rounded-2xl bg-teal-500/30 blur-lg animate-pulse-glow" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-lg">
            <ShoppingCart className="h-7 w-7 text-white" />
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight gradient-text">AisleIQ</h1>
      </div>

      <div className="glass shadow-2xl rounded-2xl p-7 space-y-5">
        {done ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/40">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100">Password updated!</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Redirecting to sign in…</p>
            </div>
            <Link
              href="/signin"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all glow-teal-sm"
            >
              Sign in <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Set new password</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Choose a strong password for{' '}
                <span className="font-medium text-slate-700 dark:text-slate-300">{email}</span>
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-slate-700 dark:text-slate-300 text-xs font-semibold uppercase tracking-wide">
                  New Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Min. 8 chars, 1 uppercase, 1 number"
                    autoComplete="new-password"
                    className="pl-9 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20 rounded-xl"
                    {...register('password')}
                  />
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive animate-slide-up">{errors.password.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-slate-700 dark:text-slate-300 text-xs font-semibold uppercase tracking-wide">
                  Confirm Password
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    id="confirm"
                    type="password"
                    placeholder="Repeat password"
                    autoComplete="new-password"
                    className="pl-9 bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20 rounded-xl"
                    {...register('confirm')}
                  />
                </div>
                {errors.confirm && (
                  <p className="text-xs text-destructive animate-slide-up">{errors.confirm.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="group relative w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:from-teal-500 hover:to-emerald-500 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none glow-teal-sm"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <>Update password <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" /></>
                )}
              </button>
            </form>
          </>
        )}
      </div>

      <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-5">
        <Link href="/signin" className="font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 hover:underline transition-colors">
          ← Back to sign in
        </Link>
      </p>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-teal-50 via-white to-emerald-50/60 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950/30" />
      <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-teal-200/30 dark:bg-teal-900/20 blur-3xl animate-float" />
      <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-emerald-200/30 dark:bg-emerald-900/20 blur-3xl animate-float" style={{ animationDelay: '2s' }} />
      <Suspense fallback={
        <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-950/40">
          <Loader2 className="h-8 w-8 text-teal-600 animate-spin" />
        </div>
      }>
        <ResetPasswordForm />
      </Suspense>
    </div>
  )
}
