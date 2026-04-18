'use client'

import { useState, useRef, useCallback } from 'react'
import { Loader2, Trash2, AlertCircle, Copy, Check, MessageSquareText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/calculations'
import { cn } from '@/lib/utils'
import type { ReceiptItem } from '@prisma/client'

interface Props {
  items: ReceiptItem[]
  storeName: string | null
  savingId: string | null
  onUpdate: (itemId: string, field: string, value: unknown) => Promise<void>
  onDelete: (itemId: string) => Promise<void>
}

type EditableField = 'item' | 'quantity' | 'unitPrice' | 'lineTotal' | 'tax'

export function ReceiptTable({ items, storeName, savingId, onUpdate, onDelete }: Props) {
  const [editCell, setEditCell] = useState<{ itemId: string; field: EditableField } | null>(null)
  const [editValue, setEditValue] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [sourceTooltip, setSourceTooltip] = useState<{ itemId: string; text: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
      if (typeof value === 'number' && isNaN(value)) value = null
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
        ? (raw as string | null) ?? '—'
        : typeof raw === 'number'
        ? field === 'quantity'
          ? raw
          : formatCurrency(raw as number)
        : '—'

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
    <div className="rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">
                Store
              </th>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-xs uppercase tracking-wide font-medium text-muted-foreground',
                    col.numeric ? 'text-right' : 'text-left',
                  )}
                >
                  {col.label}
                </th>
              ))}
              {/* Actions column */}
              <th className="px-2 py-3 w-20" />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className={cn(
                  'border-b last:border-0 hover:bg-muted/30 transition-colors group relative',
                  item.needsReview && 'bg-amber-50/50 hover:bg-amber-50 dark:bg-amber-950/20',
                )}
              >
                {/* Store */}
                <td className="px-4 py-2.5 text-muted-foreground text-xs max-w-[120px] truncate">
                  {item.store ?? storeName ?? '—'}
                </td>

                {/* Editable columns */}
                {columns.map((col) => (
                  <td
                    key={col.key}
                    onClick={() => startEdit(item, col.key)}
                    className={cn(
                      'px-4 py-2.5 cursor-pointer hover:bg-muted/50 rounded transition-colors',
                      col.numeric && 'text-right',
                      col.key === 'item' && 'max-w-[200px]',
                    )}
                  >
                    <div className={cn('flex items-center gap-1', col.numeric && 'justify-end')}>
                      {item.needsReview && col.key === 'item' && (
                        <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" title="Needs review — low OCR confidence" />
                      )}
                      <CellContent item={item} field={col.key} />
                    </div>
                  </td>
                ))}

                {/* Action buttons */}
                <td className="px-2 py-2.5">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Source text tooltip trigger */}
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

                    {/* Copy row */}
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

                    {/* Delete */}
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
            ))}

            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">
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
