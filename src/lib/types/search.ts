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
