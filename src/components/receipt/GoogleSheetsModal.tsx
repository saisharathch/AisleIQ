'use client'

import { useState, useEffect, useCallback } from 'react'
import { ExternalLink, Loader2, Sheet, AlertTriangle, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ITEM_CATEGORIES, categorizeItem } from '@/lib/google-sheets'
import type { ReceiptItem } from '@prisma/client'

const PREF_KEY = 'sheets_upload_preference'
type Pref = 'ask' | 'never'

interface GoogleAuthStatus {
  connected: boolean
  hasScope: boolean
  needsReconnect?: boolean
}

interface Props {
  receiptId: string
  storeName: string | null
  items: ReceiptItem[]
  grandTotal: number | null
  alreadyUploaded: boolean
  existingSheetUrl?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GoogleSheetsModal({
  receiptId, storeName, items, grandTotal,
  alreadyUploaded, existingSheetUrl, open, onOpenChange,
}: Props) {
  const [authStatus, setAuthStatus] = useState<GoogleAuthStatus | null>(null)
  const [categories, setCategories] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)
  const [sheetUrl, setSheetUrl] = useState<string | null>(existingSheetUrl ?? null)
  const [pref, setPref] = useState<Pref>('ask')
  const [rememberChoice, setRememberChoice] = useState(false)

  // Load saved preference
  useEffect(() => {
    const saved = localStorage.getItem(PREF_KEY) as Pref | null
    if (saved) setPref(saved)
  }, [])

  // Auto-categorize items when modal opens
  useEffect(() => {
    if (!open) return
    const initial: Record<string, string> = {}
    for (const item of items) {
      initial[item.id] = categorizeItem(item.item)
    }
    setCategories(initial)
  }, [open, items])

  // Check Google auth status
  useEffect(() => {
    if (!open) return
    fetch('/api/sheets/status')
      .then((r) => r.json())
      .then(setAuthStatus)
      .catch(() => setAuthStatus({ connected: false, hasScope: false }))
  }, [open])

  const handleUpload = useCallback(async () => {
    setUploading(true)
    try {
      const res = await fetch(`/api/receipts/${receiptId}/sheets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (data.code === 'DUPLICATE' && data.sheetUrl) {
          setSheetUrl(data.sheetUrl)
          toast.success('Already in Sheets!')
        } else if (data.code === 'SHEETS_SCOPE_MISSING' || data.code === 'GOOGLE_NOT_CONNECTED') {
          toast.error('Please reconnect your Google account with Sheets access.')
          setAuthStatus({ connected: false, hasScope: false })
        } else {
          toast.error(data.error ?? 'Upload failed')
        }
        return
      }

      setSheetUrl(data.sheetUrl)
      if (rememberChoice) localStorage.setItem(PREF_KEY, 'ask')
      toast.success('Uploaded to Google Sheets!')
    } catch {
      toast.error('Network error — upload failed')
    } finally {
      setUploading(false)
    }
  }, [receiptId, categories, rememberChoice])

  const handleSkip = useCallback(() => {
    if (rememberChoice) localStorage.setItem(PREF_KEY, 'never')
    onOpenChange(false)
  }, [rememberChoice, onOpenChange])

  const needsGoogleSignIn = authStatus !== null && (!authStatus.connected || !authStatus.hasScope)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
              <Sheet className="h-4 w-4 text-green-600" />
            </div>
            <DialogTitle>Upload to Google Sheets</DialogTitle>
          </div>
          <DialogDescription>
            Send <strong>{storeName ?? 'this receipt'}</strong> to your{' '}
            <em>Grocery Expense Tracker</em> spreadsheet — or skip.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Auth status */}
          {authStatus === null && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Checking Google connection…
            </div>
          )}

          {needsGoogleSignIn && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-amber-800">
                  {authStatus?.connected ? 'Sheets access not granted' : 'Google account not connected'}
                </p>
                <p className="text-xs text-amber-700">
                  {authStatus?.connected
                    ? 'You signed in with Google but did not grant Sheets permission. Please sign out and sign back in.'
                    : 'Sign in with Google to enable Sheets upload.'}
                </p>
                <Button size="sm" variant="outline" asChild>
                  <a href="/api/auth/signin?callbackUrl=/dashboard">Connect Google Account</a>
                </Button>
              </div>
            </div>
          )}

          {/* Already uploaded */}
          {(alreadyUploaded || sheetUrl) && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-start gap-3">
              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-green-800">Already uploaded to Sheets</p>
                {sheetUrl && (
                  <a
                    href={sheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-green-700 underline hover:text-green-900"
                  >
                    Open spreadsheet <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Items preview with category editing */}
          {!alreadyUploaded && !sheetUrl && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Preview — {items.length} items · Adjust categories if needed
              </p>
              <div className="rounded-lg border overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Item</th>
                        <th className="text-left px-3 py-2 font-medium text-muted-foreground w-36">Category</th>
                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, i) => (
                        <tr key={item.id} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                          <td className="px-3 py-1.5 truncate max-w-[180px]" title={item.item}>
                            {item.item}
                          </td>
                          <td className="px-3 py-1">
                            <Select
                              value={categories[item.id] ?? 'Other'}
                              onValueChange={(v) => setCategories((prev) => ({ ...prev, [item.id]: v }))}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ITEM_CATEGORIES.map((cat) => (
                                  <SelectItem key={cat} value={cat} className="text-xs">
                                    {cat}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-3 py-1.5 text-right tabular-nums">
                            {item.lineTotal != null ? `$${item.lineTotal.toFixed(2)}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {grandTotal != null && (
                      <tfoot className="border-t bg-muted/30">
                        <tr>
                          <td colSpan={2} className="px-3 py-2 font-medium text-sm">Grand Total</td>
                          <td className="px-3 py-2 text-right font-bold tabular-nums text-primary">
                            ${grandTotal.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Remember preference */}
          {!alreadyUploaded && !sheetUrl && (
            <label className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={rememberChoice}
                onChange={(e) => setRememberChoice(e.target.checked)}
                className="rounded"
              />
              Remember my choice for future receipts
            </label>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2 border-t">
          {sheetUrl ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              <Button asChild>
                <a href={sheetUrl} target="_blank" rel="noopener noreferrer" className="gap-2">
                  <ExternalLink className="h-4 w-4" /> Open Spreadsheet
                </a>
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={handleSkip} disabled={uploading}>
                No, skip
              </Button>
              <Button
                onClick={handleUpload}
                disabled={uploading || needsGoogleSignIn || authStatus === null}
                className="gap-2"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sheet className="h-4 w-4" />}
                {uploading ? 'Uploading…' : 'Yes, upload to Sheets'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Lightweight button that checks pref and opens the modal
export function GoogleSheetsButton({
  receiptId, storeName, items, grandTotal, alreadyUploaded, existingSheetUrl,
}: Omit<Props, 'open' | 'onOpenChange'>) {
  const [open, setOpen] = useState(false)

  const handleClick = () => {
    const pref = (localStorage.getItem(PREF_KEY) as Pref | null) ?? 'ask'
    if (pref === 'never' && !alreadyUploaded) {
      toast('Sheets upload skipped (preference set to never). Click the Sheets button to change.', { icon: '📋' })
      return
    }
    setOpen(true)
  }

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={handleClick}>
        <Sheet className="h-4 w-4 text-green-600" />
        {alreadyUploaded ? 'View in Sheets' : 'Sheets'}
      </Button>
      <GoogleSheetsModal
        receiptId={receiptId}
        storeName={storeName}
        items={items}
        grandTotal={grandTotal}
        alreadyUploaded={alreadyUploaded}
        existingSheetUrl={existingSheetUrl}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  )
}
