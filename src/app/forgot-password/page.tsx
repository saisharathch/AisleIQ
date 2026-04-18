'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { ShoppingCart, Loader2, Mail, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
    // In a real app this would call an API that sends a reset email.
    // For now we simulate the call and show a confirmation.
    await new Promise((r) => setTimeout(r, 800))
    console.log('[forgot-password] reset requested for', data.email)
    setSubmitted(true)
    toast.success('Check your inbox for reset instructions.')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-primary/5 to-background p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2 mb-8">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShoppingCart className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Forgot password?</h1>
          <p className="text-sm text-muted-foreground text-center">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        <div className="rounded-xl border bg-card shadow-sm p-6 space-y-4">
          {submitted ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <Mail className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="font-medium">Check your inbox</p>
                <p className="text-sm text-muted-foreground mt-1">
                  If an account exists for that email, a password reset link has been sent.
                </p>
              </div>
              <Link href="/signin">
                <Button variant="outline" className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back to sign in
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  {...register('email')}
                />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Send reset link
              </Button>
            </form>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Remember your password?{' '}
          <Link href="/signin" className="text-primary hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
