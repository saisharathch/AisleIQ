'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import {
  ShoppingCart, LayoutDashboard, ReceiptText, TrendingUp,
  Sheet, Settings2, Upload, LogOut, X, ShieldCheck, ClipboardCheck, Wallet, ListChecks,
} from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'

const PRIMARY_NAV = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/receipts',   icon: ReceiptText,     label: 'Receipts' },
  { href: '/analytics',  icon: TrendingUp,      label: 'Analytics' },
  { href: '/review',     icon: ClipboardCheck,  label: 'Review Queue' },
  { href: '/budgets',    icon: Wallet,          label: 'Budgets' },
  { href: '/shopping',   icon: ListChecks,      label: 'Shopping List' },
]

const SECONDARY_NAV = [
  { href: '/sheets', icon: Sheet, label: 'Google Sheets' },
  { href: '/settings', icon: Settings2, label: 'Settings' },
]

interface Props {
  onClose?: () => void
}

export function Sidebar({ onClose }: Props) {
  const pathname = usePathname()
  const { data: session } = useSession()
  const user = session?.user as { name?: string; email?: string; role?: string; image?: string } | undefined

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? '?'

  const isActive = (href: string) =>
    href === '/dashboard' ? pathname === href : pathname.startsWith(href)

  return (
    <aside className="flex h-full w-60 flex-col border-r border-slate-100 dark:border-slate-800/60 bg-white dark:bg-slate-950">
      {/* Logo */}
      <div className="flex h-14 items-center justify-between px-5 border-b border-slate-100 dark:border-slate-800/60 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2.5 group" onClick={onClose}>
          <div className="relative">
            <div className="absolute inset-0 rounded-lg bg-teal-500/30 blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 shadow-sm">
              <ShoppingCart className="h-4 w-4 text-white" />
            </div>
          </div>
          <span className="text-sm font-bold tracking-tight gradient-text">AisleIQ</span>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md p-1 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
        {/* Upload CTA */}
        <Link
          href="/receipts"
          onClick={onClose}
          className="group flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-3 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:from-teal-500 hover:to-emerald-500 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 glow-teal-sm"
        >
          <Upload className="h-4 w-4 group-hover:scale-110 transition-transform" />
          Receipt Inbox
        </Link>

        {/* Primary nav */}
        <nav className="space-y-0.5">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Navigation
          </p>
          {PRIMARY_NAV.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={onClose}
                className={`relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150 ${
                  active
                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-400'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100'
                }`}
              >
                {active && (
                  <span className="absolute left-0 inset-y-1.5 w-0.5 rounded-full bg-teal-500" />
                )}
                <item.icon className={`h-4 w-4 shrink-0 transition-transform ${
                  active ? 'text-teal-600 dark:text-teal-400 scale-110' : 'text-slate-400 dark:text-slate-500'
                }`} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Secondary nav */}
        <nav className="space-y-0.5">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Integrations
          </p>
          {SECONDARY_NAV.map((item) => {
            const active = isActive(item.href) && item.href !== '/dashboard'
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={onClose}
                className={`relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-150 ${
                  active
                    ? 'bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-400'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100'
                }`}
              >
                {active && (
                  <span className="absolute left-0 inset-y-1.5 w-0.5 rounded-full bg-teal-500" />
                )}
                <item.icon className={`h-4 w-4 shrink-0 transition-transform ${
                  active ? 'text-teal-600 dark:text-teal-400 scale-110' : 'text-slate-400 dark:text-slate-500'
                }`} />
                {item.label}
              </Link>
            )
          })}
          {user?.role === 'admin' && (
            <Link
              href="/admin"
              onClick={onClose}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100 transition-all duration-150"
            >
              <ShieldCheck className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
              Admin
            </Link>
          )}
        </nav>
      </div>

      {/* User section */}
      <div className="border-t border-slate-100 dark:border-slate-800/60 p-3 shrink-0 space-y-2">
        {/* Theme toggle */}
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Theme</span>
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 text-white text-xs font-bold shrink-0 shadow-sm">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
              {user?.name ?? 'User'}
            </p>
            <p className="truncate text-[10px] text-slate-400">{user?.email}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="text-slate-300 hover:text-rose-500 dark:hover:text-rose-400 transition-colors shrink-0 rounded-md p-1 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
