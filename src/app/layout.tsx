import type { Metadata, Viewport } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'
import { Providers } from '@/components/layout/Providers'

export const metadata: Metadata = {
  title: { default: 'AisleIQ — Upload receipts. Track smarter. Spend better.', template: '%s | AisleIQ' },
  description:
    'Upload receipts. Track smarter. Spend better. AisleIQ turns grocery receipts into structured spending insights instantly.',
  keywords: ['grocery', 'receipt scanner', 'OCR', 'expense tracker', 'spending insights', 'AisleIQ'],
  authors: [{ name: 'AisleIQ' }],
  openGraph: {
    title: 'AisleIQ — Upload receipts. Track smarter. Spend better.',
    description: 'Upload receipts. Track smarter. Spend better.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased min-h-screen bg-background">
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: { borderRadius: '8px' },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}
