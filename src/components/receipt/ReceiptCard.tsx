'use client'

import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Receipt as ReceiptIcon, CheckCircle, Clock, XCircle, Loader2, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/calculations'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

interface ReceiptCardReceipt {
  id: string
  storeName: string | null
  status: string
  grandTotal: number | null
  uploadDate: Date
  fileName: string
  _count?: { items: number }
}

const statusConfig = {
  done: { label: 'Done', icon: CheckCircle, variant: 'success' as const },
  processing: { label: 'Processing', icon: Loader2, variant: 'secondary' as const },
  pending: { label: 'Pending', icon: Clock, variant: 'outline' as const },
  failed: { label: 'Failed', icon: XCircle, variant: 'destructive' as const },
}

export function ReceiptCard({ receipt }: { receipt: ReceiptCardReceipt }) {
  const router = useRouter()
  const config = statusConfig[receipt.status as keyof typeof statusConfig] ?? statusConfig.pending
  const StatusIcon = config.icon

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault()
    if (!confirm('Delete this receipt? This cannot be undone.')) return

    const res = await fetch(`/api/receipts/${receipt.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Receipt deleted')
      router.refresh()
    } else {
      toast.error('Failed to delete receipt')
    }
  }

  return (
    <Link href={`/receipts/${receipt.id}`} className="group block">
      <div className="rounded-lg border bg-card p-4 shadow-sm hover:shadow-md transition-all hover:border-primary/30 space-y-3">
        {/* Store icon + status */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <ReceiptIcon className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">
                {receipt.storeName ?? 'Unknown Store'}
              </p>
              <p className="text-xs text-muted-foreground truncate">{receipt.fileName}</p>
            </div>
          </div>

          <Badge variant={config.variant} className="shrink-0 ml-2">
            <StatusIcon className={`h-3 w-3 mr-1 ${receipt.status === 'processing' ? 'animate-spin' : ''}`} />
            {config.label}
          </Badge>
        </div>

        {/* Totals */}
        {receipt.status === 'done' && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {receipt._count?.items ?? 0} item{receipt._count?.items !== 1 ? 's' : ''}
            </span>
            <span className="font-semibold text-primary">{formatCurrency(receipt.grandTotal)}</span>
          </div>
        )}

        {/* Date + delete */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatDistanceToNow(new Date(receipt.uploadDate), { addSuffix: true })}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Link>
  )
}
