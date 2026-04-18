'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Upload, Loader2, X, CloudUpload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { formatBytes } from '@/lib/utils'
import { cn } from '@/lib/utils'

const ACCEPTED = '.jpg,.jpeg,.png,.heic,.heif,.pdf'
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'application/pdf']
const MAX_MB = parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE_MB ?? '10')

interface Props {
  /** If true, renders a large drop zone card instead of a small button */
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

  const handleFile = useCallback(
    async (file: File) => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        toast.error(`Unsupported file type. Use JPG, PNG, HEIC, or PDF.`)
        return
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        toast.error(`File too large. Max ${MAX_MB}MB.`)
        return
      }

      setSelectedFile(file)
      setUploading(true)
      setProgress(10)

      const formData = new FormData()
      formData.append('file', file)

      try {
        setProgress(30)
        const res = await fetch('/api/receipts', { method: 'POST', body: formData })
        setProgress(60)

        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error ?? 'Upload failed')
        }

        const { data } = await res.json()
        setProgress(80)

        await pollStatus(data.id)
        setProgress(100)

        toast.success('Receipt processed!')
        router.push(`/receipts/${data.id}`)
        router.refresh()
      } catch (err: unknown) {
        toast.error((err as Error).message ?? 'Upload failed')
      } finally {
        setUploading(false)
        setSelectedFile(null)
        setProgress(0)
        if (inputRef.current) inputRef.current.value = ''
      }
    },
    [router],
  )

  async function pollStatus(id: string, attempts = 0): Promise<void> {
    if (attempts > 60) throw new Error('Processing timed out')
    const res = await fetch(`/api/receipts/${id}/status`)
    const { data } = await res.json()
    if (data.status === 'done') return
    if (data.status === 'failed') throw new Error(data.errorMessage ?? 'OCR failed')
    await new Promise((r) => setTimeout(r, 2000))
    return pollStatus(id, attempts + 1)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  // Global drag-over listener (highlights the zone from anywhere on the page)
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
      {/* Hidden file input */}
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
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            'group w-full rounded-xl border-2 border-dashed p-12 flex flex-col items-center gap-4 text-center transition-all cursor-pointer outline-none',
            dragOver
              ? 'border-primary bg-primary/5 scale-[1.01]'
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30',
            uploading && 'pointer-events-none opacity-60',
            className,
          )}
          aria-label="Upload receipt"
        >
          <div className={cn(
            'h-16 w-16 rounded-full flex items-center justify-center transition-colors',
            dragOver ? 'bg-primary/20' : 'bg-muted group-hover:bg-primary/10',
          )}>
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            ) : (
              <CloudUpload className={cn('h-8 w-8 transition-colors', dragOver ? 'text-primary' : 'text-muted-foreground group-hover:text-primary')} />
            )}
          </div>
          <div>
            <p className="font-semibold text-lg">
              {uploading ? 'Processing receipt…' : dragOver ? 'Drop to upload' : 'Upload your first receipt'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {uploading
                ? 'AI is reading your receipt, this takes a few seconds…'
                : 'Drag & drop or click to choose — JPG, PNG, HEIC, PDF up to 10 MB'}
            </p>
          </div>
          {uploading && (
            <div className="w-full max-w-xs">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1 text-center">
                {progress < 60 ? 'Uploading…' : progress < 90 ? 'Reading receipt…' : 'Almost done…'}
              </p>
            </div>
          )}
        </button>
      ) : (
        <Button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="gap-2"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? 'Processing…' : 'Upload Receipt'}
        </Button>
      )}

      {/* Full-screen processing overlay (button variant only) */}
      {uploading && variant === 'button' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Processing receipt…</h3>
              <button
                onClick={() => { setUploading(false); setSelectedFile(null); setProgress(0) }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                {selectedFile.name} — {formatBytes(selectedFile.size)}
              </p>
            )}

            <Progress value={progress} />

            <p className="text-xs text-muted-foreground text-center">
              {progress < 60 ? 'Uploading…' : progress < 90 ? 'AI reading receipt…' : 'Almost done…'}
            </p>
          </div>
        </div>
      )}
    </>
  )
}
