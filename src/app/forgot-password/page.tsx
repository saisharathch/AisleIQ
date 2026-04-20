'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { ShoppingCart, Loader2, Mail, ArrowLeft, ArrowRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const schema = z.object({ email: z.string().email('Invalid email address') })
type FormInput = z.infer<typeof schema>

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormInput>({ resolver: zodResolver(schema) })

  async function onSubmit(data: FormInput) {
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: data.email }),
    })

    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as { error?: string }
      toast.error(json.error ?? 'Something went wrong. Please try again.')
      return
    }

    setSubmitted(true)
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
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight gradient-text">AisleIQ</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Forgot password?</p>
          </div>
        </div>

        <div className="glass shadow-2xl rounded-2xl p-7 space-y-5">
          {submitted ? (
            <div className="flex flex-col items-center gap-5 py-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/40">
                <Mail className="h-7 w-7 text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100">Check your inbox</p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  If an account exists for that email, a password reset link has been sent. It expires in 1 hour.
                </p>
              </div>
              <Link
                href="/signin"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 px-5 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:border-teal-300 hover:-translate-y-0.5 transition-all"
              >
                <ArrowLeft className="h-4 w-4" /> Back to sign in
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
                Enter your email and we&apos;ll send you a reset link.
              </p>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-slate-700 dark:text-slate-300 text-xs font-semibold uppercase tracking-wide">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="bg-white/60 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20 transition-all rounded-xl"
                    {...register('email')}
                  />
                  {errors.email && (
                    <p className="text-xs text-destructive animate-slide-up">{errors.email.message}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="group relative w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:from-teal-500 hover:to-emerald-500 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none glow-teal-sm"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Send reset link
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-5">
          Remember your password?{' '}
          <Link href="/signin" className="font-semibold text-teal-600 hover:text-teal-700 dark:text-teal-400 hover:underline transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
