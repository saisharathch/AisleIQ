import Link from 'next/link'
import { ShoppingCart, Upload, Table2, Download, Shield, Zap, Star, CheckCircle } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { Button } from '@/components/ui/button'

const features = [
  {
    icon: Upload,
    title: 'Upload Any Receipt',
    description: 'JPG, PNG, HEIC, or PDF — snap a photo on mobile or upload from desktop. We handle messy, tilted, and multi-page receipts.',
  },
  {
    icon: Zap,
    title: 'Instant AI Extraction',
    description: "Claude Vision reads every line item, detecting store, items, quantities, unit prices, and tax — even from blurry or crumpled receipts.",
  },
  {
    icon: Table2,
    title: 'Editable Structured Table',
    description: 'Every item lands in a clean table. Edit any cell inline, add rows, delete mistakes, and flag items that need review.',
  },
  {
    icon: CheckCircle,
    title: 'Auto-Calculated Totals',
    description: 'Subtotal, tax, discounts, and grand total are calculated automatically. Math mismatches are flagged instantly.',
  },
  {
    icon: Download,
    title: 'Export to CSV or PDF',
    description: 'Download the structured data in one click. Share or import into any spreadsheet or accounting tool.',
  },
  {
    icon: Shield,
    title: 'Private & Secure',
    description: 'Receipts are tied to your account only. Secure auth, encrypted storage, and audit logs on every edit.',
  },
]

const steps = [
  { step: '1', title: 'Upload', description: 'Drag & drop or photograph your receipt' },
  { step: '2', title: 'Extract', description: 'AI reads every item in seconds' },
  { step: '3', title: 'Review', description: 'Edit, approve, or flag low-confidence items' },
  { step: '4', title: 'Export', description: 'Save to CSV/PDF or keep in your history' },
]

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />

      {/* Hero */}
      <section className="flex flex-col items-center justify-center gap-6 px-4 py-24 text-center bg-gradient-to-b from-primary/5 to-background">
        <div className="inline-flex items-center gap-2 rounded-full border bg-background px-4 py-1.5 text-sm text-muted-foreground shadow-sm">
          <Star className="h-3.5 w-3.5 text-primary" />
          AI-powered grocery receipt scanner
        </div>

        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          Upload receipts.{' '}
          <span className="text-primary">Track smarter.</span>{' '}
          Spend better.
        </h1>

        <p className="max-w-xl text-lg text-muted-foreground">
          AisleIQ turns grocery receipts into structured spending insights — every item, category, store, and trend — in seconds.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/signup">
            <Button size="lg" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              Start for free
            </Button>
          </Link>
          <Link href="/signin">
            <Button size="lg" variant="outline">
              Sign in
            </Button>
          </Link>
        </div>

        {/* Demo preview */}
        <div className="mt-8 w-full max-w-4xl rounded-xl border bg-card shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
            <div className="h-3 w-3 rounded-full bg-red-400" />
            <div className="h-3 w-3 rounded-full bg-yellow-400" />
            <div className="h-3 w-3 rounded-full bg-green-400" />
            <span className="ml-2 text-xs text-muted-foreground">aisleiq.app/receipts/walmart-2024</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  {['Store', 'Item', 'Qty', 'Unit Price', 'Line Total', 'Tax'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Walmart', 'Great Value Whole Milk 1 Gal', '2', '$3.98', '$7.96', '—'],
                  ['Walmart', 'Bananas (1.52 lb)', '1.52', '$0.58', '$0.88', '—'],
                  ['Walmart', 'Chicken Breast Boneless', '2.1 lb', '$4.99', '$10.48', '—'],
                  ['Walmart', 'Tide Laundry Detergent 64oz', '1', '$11.97', '$11.97', '$1.08'],
                ].map((row, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    {row.map((cell, j) => (
                      <td key={j} className="px-4 py-3 text-foreground">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted/30 font-medium">
                  <td colSpan={4} className="px-4 py-3 text-right text-muted-foreground">Grand Total</td>
                  <td className="px-4 py-3 text-primary font-bold">$43.80</td>
                  <td className="px-4 py-3 text-muted-foreground">$3.43</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-12">How it works</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {steps.map(({ step, title, description }) => (
              <div key={step} className="flex flex-col items-center text-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                  {step}
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4">
        <div className="container max-w-5xl">
          <h2 className="text-3xl font-bold text-center mb-3">Everything you need</h2>
          <p className="text-center text-muted-foreground mb-12">Built for accuracy, speed, and real-world receipts.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-lg border bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-primary/5 text-center">
        <div className="container max-w-xl">
          <h2 className="text-3xl font-bold mb-4">Ready to tame your grocery bills?</h2>
          <p className="text-muted-foreground mb-8">Start for free — no credit card required.</p>
          <Link href="/signup">
            <Button size="lg" className="gap-2">
              <Upload className="h-4 w-4" />
              Upload your first receipt
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-teal-600">
              <ShoppingCart className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="leading-none">
              <span className="font-bold text-foreground text-sm">AisleIQ</span>
              <span className="block text-[10px] text-muted-foreground">Upload receipts. Track smarter. Spend better.</span>
            </div>
          </div>
          <p>© {new Date().getFullYear()} AisleIQ. All rights reserved.</p>
          <nav className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
