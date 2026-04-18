import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import './globals.css'
import { Providers } from '@/components/layout/Providers'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: { default: 'GroceryBill — Smart Receipt Scanner', template: '%s | GroceryBill' },
  description:
    'Upload a grocery receipt and instantly get a structured, editable table of every item — with totals, tax, and export.',
  keywords: ['grocery', 'receipt scanner', 'OCR', 'bill calculator', 'expense tracker'],
  authors: [{ name: 'GroceryBill' }],
  openGraph: {
    title: 'GroceryBill — Smart Receipt Scanner',
    description: 'Upload any grocery receipt. Get instant structured data.',
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
      <body className={`${inter.variable} font-sans antialiased min-h-screen bg-background`}>
        <Providers>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: { borderRadius: '8px', fontFamily: 'var(--font-inter)' },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}
