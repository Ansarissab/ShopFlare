'use client'

import { useState, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { en } from '@/lib/i18n/en'
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants'
import type { SearchBarProps } from '@/lib/types/search'

export function SearchBar({ value, onChange }: SearchBarProps) {
  const [inputValue, setInputValue] = useState(value)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Sync when parent resets value (URL navigation, external clear). Done during
  // render rather than in an effect so the input reflects the new value on the
  // first paint and avoids an extra render pass.
  const [prevValue, setPrevValue] = useState(value)
  if (value !== prevValue) {
    setPrevValue(value)
    setInputValue(value)
  }

  // Debounced emit
  useEffect(() => {
    const timer = setTimeout(() => onChangeRef.current(inputValue), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [inputValue])

  return (
    <div className="relative w-full">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <input
        type="search"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={en.store.searchProducts}
        className="w-full h-10 rounded-lg border border-input bg-background pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
      />
      {inputValue && (
        <button
          type="button"
          aria-label={en.store.searchClearHint}
          onClick={() => setInputValue('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
