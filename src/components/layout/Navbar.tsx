'use client'

import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { ShoppingCart, LayoutDashboard, LogOut, User, ShieldCheck } from 'lucide-react'

export function Navbar() {
  const { data: session } = useSession()
  const user = session?.user as { name?: string; email?: string; role?: string } | undefined

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-semibold text-primary">
          <ShoppingCart className="h-5 w-5" />
          <span className="text-lg">GroceryBill</span>
        </Link>

        {/* Nav links */}
        <nav className="flex items-center gap-4">
          {session ? (
            <>
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>

              {user?.role === 'admin' && (
                <Link
                  href="/admin"
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Admin
                </Link>
              )}

              <span className="flex items-center gap-1.5 text-sm text-muted-foreground border-l pl-4">
                <User className="h-4 w-4" />
                {user?.name ?? user?.email}
              </span>

              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/signin" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Sign in
              </Link>
              <Link
                href="/signup"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
