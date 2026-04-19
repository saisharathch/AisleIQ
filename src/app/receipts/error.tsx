'use client'

export default function ReceiptsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 gap-4">
      <p className="text-sm font-medium text-slate-700">Failed to load receipts</p>
      <button onClick={reset} className="text-xs text-teal-600 hover:underline">Try again</button>
    </div>
  )
}
