'use client'

import { useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'

interface MonthlyTrend {
  month: string
  total: number
  count: number
}

interface CategoryTotal {
  category: string
  total: number
}

interface StoreComparison {
  store: string
  total: number
}

interface TopItem {
  item: string
  total: number
}

interface Props {
  monthlyTrend: MonthlyTrend[]
  categoryTotals: CategoryTotal[]
  storeComparison: StoreComparison[]
  topItems: TopItem[]
  totalThisMonth: number
  totalLastMonth: number
  countThisMonth: number
}

export function MonthlyDigestButton({
  monthlyTrend,
  categoryTotals,
  storeComparison,
  topItems,
  totalThisMonth,
  totalLastMonth,
  countThisMonth,
}: Props) {
  const [loading, setLoading] = useState(false)

  async function downloadDigest() {
    setLoading(true)
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const now = new Date()
      const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      const pageW = doc.internal.pageSize.getWidth()
      let y = 18

      // Header
      doc.setFillColor(13, 148, 136) // teal-600
      doc.rect(0, 0, pageW, 28, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('AisleIQ', 14, 12)
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text(`Monthly Spending Digest — ${monthLabel}`, 14, 22)
      doc.setTextColor(30, 41, 59)
      y = 38

      // KPI row
      const spendDelta = totalLastMonth === 0
        ? null
        : ((totalThisMonth - totalLastMonth) / totalLastMonth) * 100
      const kpis = [
        { label: 'This Month', value: `$${totalThisMonth.toFixed(2)}` },
        { label: 'Last Month', value: `$${totalLastMonth.toFixed(2)}` },
        { label: 'vs Last Month', value: spendDelta == null ? '—' : `${spendDelta >= 0 ? '+' : ''}${spendDelta.toFixed(1)}%` },
        { label: 'Receipts', value: String(countThisMonth) },
      ]
      const colW = (pageW - 28) / kpis.length
      kpis.forEach((kpi, i) => {
        const x = 14 + i * colW
        doc.setFillColor(248, 250, 252)
        doc.roundedRect(x, y, colW - 3, 18, 2, 2, 'F')
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(100, 116, 139)
        doc.text(kpi.label.toUpperCase(), x + 4, y + 6)
        doc.setFontSize(12)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(15, 23, 42)
        doc.text(kpi.value, x + 4, y + 14)
      })
      y += 26

      // Spending by category
      if (categoryTotals.length > 0) {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(15, 23, 42)
        doc.text('Spending by Category', 14, y)
        y += 4
        autoTable(doc, {
          startY: y,
          head: [['Category', 'Amount']],
          body: categoryTotals.slice(0, 10).map((c) => [c.category, `$${c.total.toFixed(2)}`]),
          theme: 'striped',
          headStyles: { fillColor: [13, 148, 136], textColor: 255, fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          columnStyles: { 1: { halign: 'right' } },
          margin: { left: 14, right: 14 },
        })
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
      }

      // Top stores
      if (storeComparison.length > 0) {
        if (y > 220) { doc.addPage(); y = 20 }
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(15, 23, 42)
        doc.text('Top Stores This Month', 14, y)
        y += 4
        autoTable(doc, {
          startY: y,
          head: [['Store', 'Spent']],
          body: storeComparison.slice(0, 8).map((s) => [s.store, `$${s.total.toFixed(2)}`]),
          theme: 'striped',
          headStyles: { fillColor: [13, 148, 136], textColor: 255, fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          columnStyles: { 1: { halign: 'right' } },
          margin: { left: 14, right: 14 },
        })
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
      }

      // Top items
      if (topItems.length > 0) {
        if (y > 220) { doc.addPage(); y = 20 }
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(15, 23, 42)
        doc.text('Top Items by Spend', 14, y)
        y += 4
        autoTable(doc, {
          startY: y,
          head: [['Item', 'Total Spent']],
          body: topItems.slice(0, 10).map((i) => [i.item, `$${i.total.toFixed(2)}`]),
          theme: 'striped',
          headStyles: { fillColor: [13, 148, 136], textColor: 255, fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          columnStyles: { 1: { halign: 'right' } },
          margin: { left: 14, right: 14 },
        })
        y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
      }

      // Monthly trend (last 6 months)
      if (monthlyTrend.length > 0) {
        if (y > 220) { doc.addPage(); y = 20 }
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(15, 23, 42)
        doc.text('Monthly Trend', 14, y)
        y += 4
        autoTable(doc, {
          startY: y,
          head: [['Month', 'Receipts', 'Total Spend']],
          body: monthlyTrend.slice(-6).map((m) => [m.month, String(m.count), `$${m.total.toFixed(2)}`]),
          theme: 'striped',
          headStyles: { fillColor: [13, 148, 136], textColor: 255, fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
          margin: { left: 14, right: 14 },
        })
      }

      // Footer
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(7)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(148, 163, 184)
        doc.text(
          `Generated by AisleIQ · ${now.toLocaleDateString()} · Page ${i} of ${pageCount}`,
          pageW / 2,
          doc.internal.pageSize.getHeight() - 6,
          { align: 'center' },
        )
      }

      const fileName = `AisleIQ-Digest-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}.pdf`
      doc.save(fileName)
    } catch (err) {
      console.error('[MonthlyDigestButton] PDF generation failed:', err)
      toast.error('Failed to generate PDF. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={downloadDigest}
      disabled={loading}
      className="gap-2"
    >
      {loading
        ? <Loader2 className="h-4 w-4 animate-spin" />
        : <FileDown className="h-4 w-4" />}
      Download Digest
    </Button>
  )
}
