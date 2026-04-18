'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface SearchBarProps {
  defaultValue?: string
  placeholder?: string
}

export function SearchBar({ defaultValue = '', placeholder = 'Search…' }: SearchBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const handleSearch = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set('search', value)
        params.set('page', '1')
      } else {
        params.delete('search')
      }
      startTransition(() => {
        router.push(`?${params.toString()}`)
      })
    },
    [router, searchParams],
  )

  return (
    <div className="relative max-w-sm">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="pl-9 pr-9"
        onChange={(e) => handleSearch(e.target.value)}
      />
      {defaultValue && (
        <button
          onClick={() => handleSearch('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
