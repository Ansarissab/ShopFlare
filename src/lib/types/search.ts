// Search + pagination component prop types (Phase 15).
// Centralized per DRY Rule 3 — never declare *Props per-file.

export interface SearchBarProps {
  value: string
  onChange: (value: string) => void
}

export interface InfiniteScrollSentinelProps {
  onVisible: () => void
  isLoading: boolean
  hasMore: boolean
  totalItems: number
  pageSize: number
}

/**
 * Lightweight search-index row returned by the /api/search endpoint (Phase 29).
 * Distinct from the full ProductWithVariants shape — this is the compact catalog
 * shape that Fuse.js indexes client-side. Wave 1A builds the endpoint.
 */
export interface ProductSearchItem {
  id: string
  name: string
  description: string | null
  thumbnailUrl: string | null
  priceCents: number
  categoryIds: string[]
  inStock: boolean
  variantLabels: string[]
}

/** Response shape for GET /api/products/search-index */
export interface SearchIndexResponse {
  items: ProductSearchItem[]
}

export interface GlobalSearchOverlayProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Props for an individual search result row in the overlay (DRY Rule 3). */
export interface SearchResultRowProps {
  item: ProductSearchItem
  onClick: () => void
}
