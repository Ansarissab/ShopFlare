'use client'

import { useEffect, useRef, useState, useCallback, useDeferredValue, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Search, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useApiResource } from '@/hooks/useApiResource'
import { useT } from '@/lib/i18n/Provider'
import { filterSearchItems, buildSearchFuse } from '@/lib/search/productFuse'
import { cn } from '@/lib/utils'
import { formatPrice } from '@/lib/utils/index'
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants'
import { price as priceStyle } from '@/lib/styles'
import type {
  GlobalSearchOverlayProps,
  SearchIndexResponse,
  SearchResultRowProps,
} from '@/lib/types/search'
import type { CategoryTreeResponse } from '@/lib/types/category'

// ─── GlobalSearchOverlay ─────────────────────────────────────────────────────

export function GlobalSearchOverlay({ open, onOpenChange }: GlobalSearchOverlayProps) {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Always start empty — the open-effect reads ?q= when the overlay opens.
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [inStockOnly, setInStockOnly] = useState(false)

  // Debounced URL write
  const urlDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch search index + categories (both cached by useApiResource)
  const { data: indexData } = useApiResource<SearchIndexResponse>('/api/products/search-index')
  const { data: catData } = useApiResource<CategoryTreeResponse>('/api/categories')

  // Stable reference — avoids rebuilding the Fuse index when data hasn't changed
  const items = useMemo(() => indexData?.items ?? [], [indexData])
  // /api/categories already returns only root nodes at the top level
  const topLevelCategories = catData?.categories ?? []

  // When overlay opens: read ?q= from the live searchParams (not a stale ref),
  // so re-opening after SPA navigation picks up the new page's param.
  // Also reset transient filters so a fresh open isn't pre-filtered.
  useEffect(() => {
    if (open) {
      setQuery(searchParams.get('q') ?? '')
      setCategoryId(null)
      setInStockOnly(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Debounce URL update
  useEffect(() => {
    if (!open) return
    if (urlDebounceRef.current) clearTimeout(urlDebounceRef.current)
    urlDebounceRef.current = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (query) {
        params.set('q', query)
      } else {
        params.delete('q')
      }
      router.replace(`?${params.toString()}`, { scroll: false })
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      if (urlDebounceRef.current) clearTimeout(urlDebounceRef.current)
    }
  }, [query, open, router, searchParams])

  // Deferred filtering so UI stays responsive while typing
  const deferredQuery = useDeferredValue(query)

  // Build the Fuse index once per items change — not on every keystroke.
  const searchFuse = useMemo(() => buildSearchFuse(items), [items])

  const filtered = filterSearchItems(items, {
    query: deferredQuery,
    categoryId,
    inStockOnly,
    categories: catData?.categories ?? [],
    fuse: searchFuse,
  })

  const handleResultClick = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  const handleClear = useCallback(() => {
    setQuery('')
  }, [])

  const inputRef = useRef<HTMLInputElement>(null)

  // Autofocus when opened
  useEffect(() => {
    if (open) {
      // Small delay to let the dialog animate in
      const id = setTimeout(() => inputRef.current?.focus(), 50)
      return () => clearTimeout(id)
    }
  }, [open])

  const showEmpty = deferredQuery === '' && !categoryId && !inStockOnly
  const showNoResults = !showEmpty && filtered.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-2xl max-h-[85dvh] flex flex-col gap-0 p-0 overflow-hidden"
      >
        {/* ── Header ── */}
        <DialogHeader className="px-4 pt-4 pb-0 shrink-0">
          <DialogTitle className="sr-only">{t.search.title}</DialogTitle>

          {/* Search input row */}
          <div className="relative flex items-center gap-2">
            <Search className="absolute inset-s-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.store.searchPlaceholder}
              aria-label={t.store.searchLabel}
              className="w-full h-10 rounded-lg border border-input bg-background ps-9 pe-9 text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
            />
            {query && (
              <button
                type="button"
                aria-label={t.search.clear}
                onClick={handleClear}
                className="absolute inset-e-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filter row */}
          <div className="flex flex-wrap items-center gap-3 pt-3 pb-3 border-b">
            {/* Category select */}
            <select
              value={categoryId ?? ''}
              onChange={(e) => setCategoryId(e.target.value || null)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label={t.search.allCategories}
            >
              <option value="">{t.search.allCategories}</option>
              {topLevelCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            {/* In-stock toggle */}
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="rounded border-border"
              />
              {t.search.inStockOnly}
            </label>

            {/* Results count — announced to screen readers as user types */}
            {!showEmpty && (
              <span
                role="status"
                aria-live="polite"
                className="ms-auto text-xs text-muted-foreground"
              >
                {t.search.resultsCount.replace('{count}', String(filtered.length))}
              </span>
            )}
          </div>
        </DialogHeader>

        {/* ── Results ── */}
        <div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
          {showEmpty ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t.search.startTyping}
            </p>
          ) : showNoResults ? (
            <p className="py-10 text-center text-sm text-muted-foreground">{t.search.noResults}</p>
          ) : (
            <ul role="list" className="divide-y divide-border">
              {filtered.map((item) => (
                <SearchResultRow key={item.id} item={item} onClick={handleResultClick} />
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── SearchResultRow ──────────────────────────────────────────────────────────

function SearchResultRow({ item, onClick }: SearchResultRowProps) {
  return (
    <li>
      <Link
        href={`/product/${item.id}`}
        onClick={onClick}
        className="flex items-center gap-3 py-3 group rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {/* Thumbnail */}
        <div className="shrink-0 w-12 h-12 rounded-md bg-muted overflow-hidden border border-border/50">
          {item.thumbnailUrl ? (
            <Image
              src={item.thumbnailUrl}
              alt={item.name}
              width={48}
              height={48}
              className="w-full h-full object-cover"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Search className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
            {item.name}
          </p>
          {item.description && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</p>
          )}
        </div>

        {/* Price */}
        {item.priceCents > 0 && (
          <p className={cn('shrink-0 text-sm font-medium text-foreground', priceStyle.mono)}>
            {formatPrice(item.priceCents)}
          </p>
        )}
      </Link>
    </li>
  )
}
