import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl

  // Protect dashboard, receipts, and admin routes
  const protectedPaths = ['/dashboard', '/receipts', '/admin']
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p))

  if (isProtected && !req.auth) {
    return NextResponse.redirect(new URL('/signin', req.url))
  }

  // Admin-only guard
  if (pathname.startsWith('/admin')) {
    const role = (req.auth?.user as { role?: string })?.role
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/dashboard/:path*', '/receipts/:path*', '/admin/:path*'],
}
