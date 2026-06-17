'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { useT } from '@/lib/i18n/Provider'
import { apiGet } from '@/lib/api'
import { SEARCH_DEBOUNCE_MS } from '@/lib/constants'
import type { AdminOrdersResponse, ProductsResponse } from '@/lib/types/admin'

// ─── Local types ─────────────────────────────────────────────────────────────

interface SearchResult {
  id: string
  label: string
  sub?: string
  href: string
  group: 'products' | 'orders'
}

// ─── AdminSearch ──────────────────────────────────────────────────────────────

export default function AdminSearch() {
  const t = useT()
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)

  // ─── debounce ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [query])

  // ─── Fetch + filter ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([])
      setOpen(false)
      return
    }

    const q = debouncedQuery.toLowerCase()
    let cancelled = false

    async function run() {
      setLoading(true)
      try {
        const [productsRes, ordersRes] = await Promise.all([
          apiGet<ProductsResponse>('/api/admin/products'),
          apiGet<AdminOrdersResponse>('/api/admin/orders?limit=50'),
        ])

        if (cancelled) return

        const productHits: SearchResult[] = (productsRes?.products ?? [])
          .filter(({ product }) => product.name.toLowerCase().includes(q))
          .slice(0, 5)
          .map(({ product }) => ({
            id: product.id,
            label: product.name,
            sub: product.active ? undefined : t.admin.inactive,
            href: `/admin/products/${product.id}`,
            group: 'products' as const,
          }))

        const orderHits: SearchResult[] = (ordersRes?.orders ?? [])
          .filter(
            (o) =>
              o.id.toLowerCase().includes(q) ||
              o.orderNumber.toLowerCase().includes(q) ||
              o.customerName.toLowerCase().includes(q) ||
              (o.customerEmail ?? '').toLowerCase().includes(q),
          )
          .slice(0, 5)
          .map((o) => ({
            id: o.id,
            label: `#${o.orderNumber}`,
            sub: o.customerName,
            href: `/admin/orders/${o.id}`,
            group: 'orders' as const,
          }))

        setResults([...productHits, ...orderHits])
        setOpen(true)
        setHighlighted(0)
      } catch {
        // API error — leave previous results visible, don't crash
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [debouncedQuery, t.admin.inactive])

  // ─── Keyboard navigation ──────────────────────────────────────────────────

  const navigate = useCallback(
    (result: SearchResult) => {
      router.push(result.href)
      setQuery('')
      setOpen(false)
      inputRef.current?.blur()
    },
    [router],
  )

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return

    if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((h) => (h + 1) % Math.max(results.length, 1))
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((h) => (h - 1 + Math.max(results.length, 1)) % Math.max(results.length, 1))
      return
    }

    if (e.key === 'Enter' && results.length > 0) {
      navigate(results[highlighted] ?? results[0])
    }
  }

  // ─── Close on outside click ───────────────────────────────────────────────

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  // ─── Group helpers ────────────────────────────────────────────────────────

  const productResults = results.filter((r) => r.group === 'products')
  const orderResults = results.filter((r) => r.group === 'orders')
  const hasResults = results.length > 0
  const showEmpty = open && debouncedQuery.trim() && !loading && !hasResults

  // Flat index → highlighted mapping
  const flatIndex = (r: SearchResult) => results.indexOf(r)

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      {/* Input */}
      <div className="relative flex items-center">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          ref={inputRef}
          data-shortcut-search
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            if (!e.target.value.trim()) setOpen(false)
          }}
          onFocus={() => {
            if (results.length > 0) setOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder={t.admin.search.placeholder}
          className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-0"
          aria-label={t.admin.search.placeholder}
          aria-autocomplete="list"
          aria-controls={open ? 'admin-search-dropdown' : undefined}
          aria-activedescendant={
            open && results.length > 0 ? `admin-search-item-${highlighted}` : undefined
          }
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div
          id="admin-search-dropdown"
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-md border border-border bg-popover shadow-md"
        >
          {showEmpty && (
            <p className="px-3 py-2 text-sm text-muted-foreground">{t.admin.search.empty}</p>
          )}

          {!showEmpty && hasResults && (
            <>
              {productResults.length > 0 && (
                <div>
                  <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t.admin.search.products}
                  </p>
                  {productResults.map((r) => (
                    <button
                      key={r.id}
                      id={`admin-search-item-${flatIndex(r)}`}
                      role="option"
                      aria-selected={flatIndex(r) === highlighted}
                      onPointerDown={(e) => {
                        e.preventDefault()
                        navigate(r)
                      }}
                      className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm ${
                        flatIndex(r) === highlighted
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-accent hover:text-accent-foreground'
                      }`}
                    >
                      <span className="font-medium">{r.label}</span>
                      {r.sub && <span className="text-xs text-muted-foreground">{r.sub}</span>}
                    </button>
                  ))}
                </div>
              )}

              {orderResults.length > 0 && (
                <div>
                  <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t.admin.search.orders}
                  </p>
                  {orderResults.map((r) => (
                    <button
                      key={r.id}
                      id={`admin-search-item-${flatIndex(r)}`}
                      role="option"
                      aria-selected={flatIndex(r) === highlighted}
                      onPointerDown={(e) => {
                        e.preventDefault()
                        navigate(r)
                      }}
                      className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm ${
                        flatIndex(r) === highlighted
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-accent hover:text-accent-foreground'
                      }`}
                    >
                      <span className="font-medium">{r.label}</span>
                      {r.sub && <span className="text-xs text-muted-foreground">{r.sub}</span>}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
