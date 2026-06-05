'use client'

import { useEffect, useRef } from 'react'
import { en } from '@/lib/i18n/en'

interface InfiniteScrollSentinelProps {
  onVisible: () => void
  isLoading: boolean
  hasMore: boolean
  totalItems: number
  pageSize: number
}

export function InfiniteScrollSentinel({
  onVisible,
  isLoading,
  hasMore,
  totalItems,
  pageSize,
}: InfiniteScrollSentinelProps) {
  const ref = useRef<HTMLDivElement>(null)
  const onVisibleRef = useRef(onVisible)
  useEffect(() => { onVisibleRef.current = onVisible }, [onVisible])

  useEffect(() => {
    const el = ref.current
    if (!el || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading) {
          onVisibleRef.current()
        }
      },
      { rootMargin: '200px' },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, isLoading])

  // Nothing to paginate — all items fit in one page
  if (totalItems <= pageSize) return null

  return (
    <div ref={ref} className="flex justify-center py-8 text-sm text-muted-foreground">
      {hasMore && isLoading && <span>{en.store.loadingMore}</span>}
      {!hasMore && <span>{en.store.allProductsLoaded}</span>}
    </div>
  )
}
