'use client'

import { useState } from 'react'
import { Download, FileText, FileSpreadsheet, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'

interface Props {
  receiptId: string
  storeName: string | null
}

export function ExportMenu({ receiptId, storeName }: Props) {
  const [loading, setLoading] = useState<'csv' | 'pdf' | null>(null)

  async function exportCSV() {
    setLoading('csv')
    try {
      const res = await fetch(`/api/receipts/${receiptId}/export?format=csv`)
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(storeName ?? 'receipt').replace(/\s+/g, '-').toLowerCase()}-${receiptId.slice(0, 8)}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV downloaded')
    } catch {
      toast.error('Export failed')
    } finally {
      setLoading(null)
    }
  }

  async function exportPDF() {
    setLoading('pdf')
    try {
      const res = await fetch(`/api/receipts/${receiptId}/export?format=pdf`)
      if (!res.ok) throw new Error('Export failed')
      const { data, fileName } = await res.json()

      // Dynamic import to keep bundle small
      const { default: jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF()
      doc.setFontSize(16)
      doc.text(data.title, 14, 20)
      doc.setFontSize(10)
      doc.setTextColor(100)
      doc.text(data.date, 14, 28)

      autoTable(doc, {
        startY: 35,
        head: [data.columns],
        body: data.rows,
        styles: { fontSize: 9 },
        headStyles: { fillColor: [34, 197, 94] },
      })

      const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8
      doc.setFontSize(10)
      doc.text(`Subtotal: ${data.subtotal}`, 14, finalY)
      doc.text(`Tax: ${data.totalTax}`, 14, finalY + 6)
      if (data.discount) doc.text(`Discount: -${data.discount}`, 14, finalY + 12)
      doc.setFontSize(12)
      doc.setTextColor(34, 197, 94)
      doc.text(`Grand Total: ${data.grandTotal}`, 14, finalY + (data.discount ? 20 : 14))

      doc.save(`${fileName}.pdf`)
      toast.success('PDF downloaded')
    } catch {
      toast.error('PDF export failed')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV} disabled={!!loading}>
        {loading === 'csv' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="h-4 w-4" />
        )}
        CSV
      </Button>
      <Button variant="outline" size="sm" className="gap-2" onClick={exportPDF} disabled={!!loading}>
        {loading === 'pdf' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
        PDF
      </Button>
    </div>
  )
}
