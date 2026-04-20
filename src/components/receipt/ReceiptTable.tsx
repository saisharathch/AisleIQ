'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Loader2, Trash2, AlertCircle, Copy, Check, MessageSquareText, TrendingUp, TrendingDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/calculations'
import { ITEM_CATEGORIES } from '@/lib/google-sheets'
import { cn } from '@/lib/utils'
import type { ReceiptItem } from '@prisma/client'

interface PriceHistory {
  avg: number
  count: number
}

interface Props {
  items: ReceiptItem[]
  storeName: string | null
  savingId: string | null
  receiptId?: string
  onUpdate: (itemId: string, field: string, value: unknown) => Promise<void>
  onDelete: (itemId: string) => Promise<void>
}

type EditableField = 'item' | 'quantity' | 'unitPrice' | 'lineTotal' | 'tax'

export function ReceiptTable({ items, storeName, savingId, receiptId, onUpdate, onDelete }: Props) {
  const [editCell, setEditCell] = useState<{ itemId: string; field: EditableField } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [sourceTooltip, setSourceTooltip] = useState<{ itemId: string; text: string } | null>(null)
  const [priceHistory, setPriceHistory] = useState<Record<string, PriceHistory>>({})
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (items.length === 0) return
    const names = [...new Set(items.map((i) => i.item.trim()))].join(',')
    const params = new URLSearchParams({ names })
    if (receiptId) params.set('excludeReceiptId', receiptId)
    fetch(`/api/price-history?${params}`)
      .then((r) => r.json())
      .then(({ data }) => setPriceHistory(data ?? {}))
      .catch(() => undefined)
  }, [items, receiptId])

  function startEdit(item: ReceiptItem, field: EditableField) {
    const raw = item[field]
    setEditCell({ itemId: item.id, field })
    setEditValue(raw === null || raw === undefined ? '' : String(raw))
    setTimeout(() => inputRef.current?.select(), 0)
  }

  async function commitEdit(item: ReceiptItem) {
    if (!editCell) return
    const { field } = editCell

    let value: string | number | null = editValue.trim()
    if (field !== 'item') {
      value = value === '' ? null : parseFloat(value)
      if (typeof value === 'number' && Number.isNaN(value)) value = null
    }

    setEditCell(null)
    if (value !== item[field]) {
      await onUpdate(item.id, field, value)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent, item: ReceiptItem) {
    if (e.key === 'Enter') commitEdit(item)
    if (e.key === 'Escape') setEditCell(null)
  }

  const copyRow = useCallback(async (item: ReceiptItem) => {
    const text = [
      storeName ?? '',
      item.item,
      item.category ?? '',
      item.quantity ?? '',
      item.unitPrice != null ? item.unitPrice.toFixed(2) : '',
      item.lineTotal != null ? item.lineTotal.toFixed(2) : '',
      item.tax != null ? item.tax.toFixed(2) : '',
    ].join('\t')
    await navigator.clipboard.writeText(text)
    setCopiedId(item.id)
    setTimeout(() => setCopiedId(null), 1500)
  }, [storeName])

  function CellContent({ item, field }: { item: ReceiptItem; field: EditableField }) {
    const isEditing = editCell?.itemId === item.id && editCell?.field === field
    const isSaving = savingId === item.id

    if (isEditing) {
      return (
        <input
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => commitEdit(item)}
          onKeyDown={(e) => handleKeyDown(e, item)}
          className="w-full bg-transparent outline-none border-b border-primary text-sm py-0.5"
          type={field === 'item' ? 'text' : 'number'}
          step={field === 'quantity' ? '0.001' : '0.01'}
          min="0"
        />
      )
    }

    const raw = item[field]
    const displayValue =
      field === 'item'
        ? (raw as string | null) ?? '-'
        : typeof raw === 'number'
          ? field === 'quantity'
            ? raw
            : formatCurrency(raw as number)
          : '-'

    return (
      <span className={cn('text-sm', raw === null && field !== 'item' && 'text-muted-foreground italic')}>
        {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin inline" /> : displayValue}
      </span>
    )
  }

  const columns: { key: EditableField; label: string; numeric?: boolean }[] = [
    { key: 'item', label: 'Item' },
    { key: 'quantity', label: 'Qty', numeric: true },
    { key: 'unitPrice', label: 'Unit Price', numeric: true },
    { key: 'lineTotal', label: 'Line Total', numeric: true },
    { key: 'tax', label: 'Tax', numeric: true },
  ]

  return (
    <div className="rounded-2xl border overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">
                Store
              </th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    'px-4 py-3 text-xs uppercase tracking-wide font-medium text-muted-foreground',
                    column.numeric ? 'text-right' : 'text-left',
                  )}
                >
                  {column.label}
                </th>
              ))}
              <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">
                Category
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">
                Confidence
              </th>
              <th className="px-2 py-3 w-24" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const confidencePercent = Math.round((item.confidence ?? 0) * 100)

              return (
                <tr
                  key={item.id}
                  className={cn(
                    'border-b last:border-0 hover:bg-muted/20 transition-colors group relative',
                    item.needsReview && 'bg-amber-50/60 hover:bg-amber-50 dark:bg-amber-950/20',
                  )}
                >
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-[120px] truncate">
                    {item.store ?? storeName ?? '-'}
                  </td>

                  {columns.map((column) => {
                    const hist = column.key === 'unitPrice'
                      ? priceHistory[item.item.trim().toLowerCase()]
                      : null
                    const priceDelta = hist && item.unitPrice != null && hist.count >= 2
                      ? ((item.unitPrice - hist.avg) / hist.avg) * 100
                      : null

                    return (
                      <td
                        key={column.key}
                        onClick={() => startEdit(item, column.key)}
                        className={cn(
                          'px-4 py-3 cursor-pointer hover:bg-muted/40 rounded transition-colors align-top',
                          column.numeric && 'text-right',
                          column.key === 'item' && 'max-w-[220px]',
                          item.needsReview && column.key !== 'tax' && 'ring-1 ring-inset ring-amber-200/70',
                        )}
                      >
                        <div className={cn('flex items-center gap-1.5', column.numeric && 'justify-end')}>
                          {item.needsReview && column.key === 'item' && (
                            <span title="Likely needs human review">
                              <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                            </span>
                          )}
                          <CellContent item={item} field={column.key} />
                          {priceDelta !== null && Math.abs(priceDelta) >= 5 && (
                            <span
                              title={`${priceDelta > 0 ? 'Up' : 'Down'} ${Math.abs(priceDelta).toFixed(0)}% vs your avg of ${formatCurrency(hist!.avg)}`}
                              className={cn(
                                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold shrink-0',
                                priceDelta > 0
                                  ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
                              )}
                            >
                              {priceDelta > 0
                                ? <TrendingUp className="h-2.5 w-2.5" />
                                : <TrendingDown className="h-2.5 w-2.5" />}
                              {Math.abs(priceDelta).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </td>
                    )
                  })}

                  <td className="px-4 py-3 min-w-[160px]">
                    <Select
                      value={item.category ?? 'Other'}
                      onValueChange={(value) => onUpdate(item.id, 'category', value)}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background/80">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ITEM_CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category} className="text-xs">
                            {category}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>

                  <td className="px-4 py-3 min-w-[150px]">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className={cn(
                          'font-medium',
                          confidencePercent < 70 ? 'text-amber-700' : 'text-muted-foreground',
                        )}>
                          {confidencePercent}%
                        </span>
                        <span className={cn(
                          'rounded-full px-2 py-0.5 text-[11px]',
                          item.needsReview
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-700',
                        )}>
                          {item.needsReview ? 'Check' : 'Looks good'}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            confidencePercent < 70 ? 'bg-amber-500' : 'bg-emerald-500',
                          )}
                          style={{ width: `${confidencePercent}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  <td className="px-2 py-3">
                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      {item.sourceText && (
                        <div className="relative">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            title="Show original OCR text"
                            onClick={() =>
                              setSourceTooltip(
                                sourceTooltip?.itemId === item.id
                                  ? null
                                  : { itemId: item.id, text: item.sourceText! },
                              )
                            }
                          >
                            <MessageSquareText className="h-3.5 w-3.5" />
                          </Button>
                          {sourceTooltip?.itemId === item.id && (
                            <div className="absolute right-8 top-0 z-20 w-64 rounded-lg border bg-popover p-3 shadow-md text-xs text-popover-foreground">
                              <p className="font-medium mb-1 text-muted-foreground">Original OCR text:</p>
                              <p className="font-mono whitespace-pre-wrap break-words">{sourceTooltip.text}</p>
                            </div>
                          )}
                        </div>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Copy row as TSV"
                        onClick={() => copyRow(item)}
                      >
                        {copiedId === item.id ? (
                          <Check className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title="Delete row"
                        onClick={() => onDelete(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}

            {items.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground text-sm">
                  No items yet. Add a row or wait for OCR to complete.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
