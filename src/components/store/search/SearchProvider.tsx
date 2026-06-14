'use client'

// SearchProvider — owns open state for the global search overlay and lazy-loads
// the overlay via next/dynamic so fuse.js + the overlay JS are not in the
// initial bundle. Wave 2 wraps the store layout in <SearchProvider> and the
// header's search button calls openSearch().

import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import type { GlobalSearchOverlayProps } from '@/lib/types/search'

// ─── Lazy overlay ────────────────────────────────────────────────────────────
//
// ssr: false — the overlay is entirely client-side; server-rendering it would
// pull fuse.js into the SSR bundle and block the initial render.

const LazyOverlay = dynamic<GlobalSearchOverlayProps>(
  () => import('./GlobalSearchOverlay').then((mod) => ({ default: mod.GlobalSearchOverlay })),
  { ssr: false },
)

// ─── Context ─────────────────────────────────────────────────────────────────

interface SearchOverlayContextValue {
  open: boolean
  openSearch: () => void
  closeSearch: () => void
}

const SearchOverlayContext = createContext<SearchOverlayContextValue | null>(null)

// ─── Provider ────────────────────────────────────────────────────────────────

export function SearchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  // Gate: only mount the overlay after the user has opened search at least once.
  // This prevents the dynamic chunk (fuse.js + overlay) and the
  // /api/products/search-index fetch from firing on every page hydration.
  const [hasOpened, setHasOpened] = useState(false)

  const openSearch = useCallback(() => {
    setHasOpened(true)
    setOpen(true)
  }, [])
  const closeSearch = useCallback(() => setOpen(false), [])

  return (
    <SearchOverlayContext.Provider value={{ open, openSearch, closeSearch }}>
      {children}
      {/* Only mount after first open — keeps the chunk + fetch off the critical
          path. Once mounted it stays in the DOM so focus/state survive
          open/close cycles without re-mounting. */}
      {hasOpened && <LazyOverlay open={open} onOpenChange={setOpen} />}
    </SearchOverlayContext.Provider>
  )
}

// ─── Hook ────────────────────────────────────────────────────────────────

/**
 * Returns the global search overlay API.
 * Must be used inside <SearchProvider>.
 *
 * Wave 2 usage:
 *   const { openSearch } = useSearchOverlay()
 *   <button onClick={openSearch}>Search</button>
 */
export function useSearchOverlay(): SearchOverlayContextValue {
  const ctx = useContext(SearchOverlayContext)
  if (!ctx) {
    throw new Error('useSearchOverlay must be used inside <SearchProvider>')
  }
  return ctx
}
