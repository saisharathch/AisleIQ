'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import {
  ShoppingCart, LayoutDashboard, ReceiptText, TrendingUp,
  Sheet, Settings2, Upload, LogOut, X, ShieldCheck, ClipboardCheck, Wallet,
} from 'lucide-react'

const PRIMARY_NAV = [
  { href: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/receipts',   icon: ReceiptText,     label: 'Receipts' },
  { href: '/analytics',  icon: TrendingUp,      label: 'Analytics' },
  { href: '/review',     icon: ClipboardCheck,  label: 'Review Queue' },
  { href: '/budgets',    icon: Wallet,          label: 'Budgets' },
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
    <aside className="flex h-full w-60 flex-col border-r border-slate-100 bg-white">
      {/* Logo */}
      <div className="flex h-14 items-center justify-between px-5 border-b border-slate-100 shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2.5" onClick={onClose}>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600">
            <ShoppingCart className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight text-slate-900">AisleIQ</span>
        </Link>
        {onClose && (
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
        {/* Upload CTA */}
        <Link
          href="/receipts"
          onClick={onClose}
          className="flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700 transition-colors"
        >
          <Upload className="h-4 w-4" />
          Receipt Inbox
        </Link>

        {/* Primary nav */}
        <nav className="space-y-0.5">
          <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Navigation
          </p>
          {PRIMARY_NAV.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <item.icon className={`h-4 w-4 shrink-0 ${active ? 'text-teal-600' : 'text-slate-400'}`} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* Secondary nav */}
        <nav className="space-y-0.5">
          <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Integrations
          </p>
          {SECONDARY_NAV.map((item) => {
            const active = isActive(item.href) && item.href !== '/dashboard'
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0 text-slate-400" />
                {item.label}
              </Link>
            )
          })}
          {user?.role === 'admin' && (
            <Link
              href="/admin"
              onClick={onClose}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <ShieldCheck className="h-4 w-4 shrink-0 text-slate-400" />
              Admin
            </Link>
          )}
        </nav>
      </div>

      {/* User section */}
      <div className="border-t border-slate-100 p-3 shrink-0">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-600 text-white text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-900">
              {user?.name ?? 'User'}
            </p>
            <p className="truncate text-[10px] text-slate-400">{user?.email}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="text-slate-400 hover:text-slate-700 transition-colors shrink-0"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
