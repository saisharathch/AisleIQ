'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Upload, Loader2, X, CloudUpload, Copy, ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatBytes, cn } from '@/lib/utils'
import { getFriendlyErrorMessage, readApiError } from '@/lib/api-client'

const ACCEPTED = '.jpg,.jpeg,.png,.heic,.heif,.pdf'
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'application/pdf']
const MAX_MB = parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB ?? '10')

interface Props {
  variant?: 'button' | 'zone'
  className?: string
}

export function UploadButton({ variant = 'button', className }: Props) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [activeUploadKey, setActiveUploadKey] = useState<string | null>(null)

  const handleFile = useCallback(
    async (file: File) => {
      const uploadKey = `${file.name}:${file.size}:${file.lastModified}`
      if (uploading || activeUploadKey === uploadKey) {
        toast.error('This receipt is already uploading. Please wait for the current attempt to finish.')
        return
      }

      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error('Unsupported file type. Use JPG, PNG, HEIC, or PDF.')
        return
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        toast.error(`File too large. Max ${MAX_MB}MB.`)
        return
      }

      setSelectedFile(file)
      setUploading(true)
      setActiveUploadKey(uploadKey)
      setProgress(10)

      const formData = new FormData()
      formData.append('file', file)

      try {
        setProgress(30)
        const res = await fetch('/api/receipts', { method: 'POST', body: formData })
        setProgress(60)

        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as Record<string, unknown>

          if (body.code === 'DUPLICATE_FILE') {
            const storeName   = (body.storeName as string | null) ?? 'Unknown Store'
            const receiptId   = body.existingReceiptId as string
            const dateStr     = body.date ? new Date(body.date as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null
            const grandTotal  = typeof body.grandTotal === 'number' ? `$${body.grandTotal.toFixed(2)}` : null

            toast(
              (t) => (
                <div className="flex flex-col gap-2 min-w-[240px]">
                  <div className="flex items-start gap-2">
                    <Copy className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm text-slate-900">Already uploaded</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {storeName}{dateStr ? ` · ${dateStr}` : ''}{grandTotal ? ` · ${grandTotal}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => toast.dismiss(t.id)}
                      className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1"
                    >
                      Dismiss
                    </button>
                    <a
                      href={`/receipts/${receiptId}`}
                      onClick={() => toast.dismiss(t.id)}
                      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md px-3 py-1 transition-colors"
                    >
                      View receipt <ArrowRight className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              ),
              { duration: 10000, icon: null },
            )
            return
          }

          const error = await readApiError(new Response(JSON.stringify(body), { status: res.status }), 'Upload failed')
          throw new Error(getFriendlyErrorMessage(error))
        }

        const { data } = await res.json()
        setProgress(100)

        toast.success('Receipt uploaded. We are processing it now.')
        router.push(`/receipts/${data.id}`)
        router.refresh()
      } catch (err: unknown) {
        toast.error((err as Error).message ?? 'Upload failed')
      } finally {
        setUploading(false)
        setActiveUploadKey(null)
        setSelectedFile(null)
        setProgress(0)
        if (inputRef.current) inputRef.current.value = ''
      }
    },
    [activeUploadKey, router, uploading],
  )

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  useEffect(() => {
    if (variant !== 'zone') return

    const onDragEnter = () => setDragOver(true)
    const onDragLeave = (e: DragEvent) => {
      if (!e.relatedTarget) setDragOver(false)
    }

    window.addEventListener('dragenter', onDragEnter)
    window.addEventListener('dragleave', onDragLeave)

    return () => {
      window.removeEventListener('dragenter', onDragEnter)
      window.removeEventListener('dragleave', onDragLeave)
    }
  }, [variant])

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        capture="environment"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />

      {variant === 'zone' ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            'group relative w-full rounded-2xl border-2 border-dashed p-12 flex flex-col items-center gap-5 text-center transition-all duration-300 cursor-pointer outline-none overflow-hidden',
            dragOver
              ? 'border-teal-400 bg-teal-50/60 dark:bg-teal-950/30 scale-[1.01]'
              : 'border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-700 hover:bg-slate-50/60 dark:hover:bg-slate-900/40',
            uploading && 'pointer-events-none opacity-60',
            className,
          )}
          aria-label="Upload receipt"
        >
          {/* Subtle dot grid background */}
          <div className={cn(
            'absolute inset-0 transition-opacity duration-300',
            dragOver ? 'opacity-100' : 'opacity-0 group-hover:opacity-60',
          )}
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(20,184,166,0.15) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />

          <div
            className={cn(
              'relative h-20 w-20 rounded-2xl flex items-center justify-center transition-all duration-300',
              dragOver
                ? 'bg-teal-100 dark:bg-teal-900/50 scale-110 rotate-3'
                : 'bg-slate-100 dark:bg-slate-800 group-hover:bg-teal-50 dark:group-hover:bg-teal-950/40 group-hover:scale-105',
            )}
          >
            {uploading ? (
              <Loader2 className="h-9 w-9 animate-spin text-teal-600" />
            ) : (
              <CloudUpload
                className={cn(
                  'h-9 w-9 transition-colors duration-200',
                  dragOver ? 'text-teal-600' : 'text-slate-400 group-hover:text-teal-500',
                )}
              />
            )}
          </div>

          <div className="relative space-y-1.5">
            <p className={cn(
              'font-bold text-xl transition-colors duration-200',
              dragOver ? 'text-teal-700 dark:text-teal-300' : 'text-slate-900 dark:text-slate-100',
            )}>
              {uploading ? 'Processing receipt...' : dragOver ? 'Drop it like it\'s hot 🔥' : 'Upload your receipt'}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
              {uploading
                ? 'AI is reading your receipt. This takes a few seconds...'
                : 'Drag and drop or click to choose · JPG, PNG, HEIC, PDF up to 10 MB'}
            </p>
          </div>

          {uploading && (
            <div className="relative w-full max-w-xs space-y-2">
              {/* Gradient progress bar */}
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-500 ease-out shadow-sm"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 text-center">
                {progress < 60 ? 'Uploading...' : progress < 100 ? 'Queueing receipt...' : 'Opening review page...'}
              </p>
            </div>
          )}

          {!uploading && (
            <div className={cn(
              'relative inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200',
              dragOver
                ? 'bg-gradient-to-r from-teal-500 to-emerald-600 scale-105'
                : 'bg-gradient-to-r from-teal-600 to-emerald-600 group-hover:from-teal-500 group-hover:to-emerald-500 group-hover:shadow-lg group-hover:-translate-y-0.5',
            )}>
              <Upload className="h-4 w-4" />
              Choose File
            </div>
          )}
        </button>
      ) : (
        <Button onClick={() => inputRef.current?.click()} disabled={uploading} className="gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 border-0 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 glow-teal-sm">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? 'Processing...' : 'Upload Receipt'}
        </Button>
      )}

      {/* Modal overlay for button variant */}
      {uploading && variant === 'button' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-md animate-fade-in">
          <div className="glass shadow-2xl rounded-2xl p-7 w-full max-w-sm space-y-5 animate-scale-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100">Processing receipt...</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">AI is reading your data</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setUploading(false)
                  setActiveUploadKey(null)
                  setSelectedFile(null)
                  setProgress(0)
                }}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {selectedFile && (
              <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                {selectedFile.name} · {formatBytes(selectedFile.size)}
              </p>
            )}

            {/* Gradient progress bar */}
            <div className="space-y-2">
              <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{progress < 60 ? 'Uploading...' : progress < 100 ? 'Queueing receipt...' : 'Opening review page...'}</span>
                <span className="font-semibold text-teal-600">{progress}%</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
