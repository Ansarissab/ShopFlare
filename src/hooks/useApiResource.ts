'use client'

// Generic data-fetching hook that encapsulates the repeated useState/useEffect/
// apiGet/ApiError scaffolding found across store pages.
//
// Null-path semantics: when `path` is null (or empty), the hook stays in
// { loading: true } indefinitely — it never transitions to loading=false until
// a real path is provided. This matches the existing page behaviour where pages
// guard on `params?.slug` / `params?.orderId` inside their own useEffect and
// simply return the skeleton while the router is still hydrating the params.

import { useEffect, useRef, useState } from 'react'
import { apiGet, ApiError } from '@/lib/api'
import type { ApiResourceState } from '@/lib/types/common'

export type { ApiResourceState }

// Shared BroadcastChannel name for cross-tab data invalidation.
// Post any message to this channel to trigger a silent re-fetch in all
// subscribers (useApiResource with refetchOnChannel + useStoreConfig).
export const DATA_UPDATED_CHANNEL = 'shopflare:data-updated'

export interface UseApiResourceOptions<T = unknown> {
  // Re-fetch silently when the browser tab regains focus. Use for data that
  // can change in another tab or context (e.g. store config).
  refetchOnFocus?: boolean
  // Re-fetch silently whenever a message arrives on DATA_UPDATED_CHANNEL.
  refetchOnChannel?: boolean
  // Re-fetch in the background every N milliseconds (e.g. 60_000 for 60 s).
  refetchInterval?: number
  // SSR-seeded initial data. When provided the hook starts in a non-loading
  // state (no skeleton on first paint) and still revalidates in the background.
  // Has no effect if the path is already in the in-memory cache (cache wins).
  fallbackData?: T
}

const _cache = new Map<string, unknown>()

// Only cache read-only public content — never transactional/order paths.
const shouldCache = (path: string) => !path.startsWith('/api/orders')

// _cache is a client-only SPA-nav optimization — never read during SSR. A warm
// worker isolate keeps it populated across requests, so reading it server-side
// diverges from the client's fresh (empty) cache and triggers a hydration
// mismatch that blanks the grid (white flash → LCP reset). Exported for testing.
export const canReadCache = (path: string): boolean =>
  shouldCache(path) && typeof window !== 'undefined' && _cache.has(path)

export function useApiResource<T>(
  path: string | null,
  opts?: UseApiResourceOptions<T>,
): ApiResourceState<T> {
  const [data, setData] = useState<T | null>(() => {
    if (path && canReadCache(path)) return _cache.get(path) as T
    if (opts?.fallbackData !== undefined) return opts.fallbackData
    return null
  })
  const [loading, setLoading] = useState(() => {
    if (path && canReadCache(path)) return false
    if (opts?.fallbackData !== undefined) return false
    // No cache, no fallback: start loading (or stay loading if path is null).
    return true
  })
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  // Bump to trigger a silent background re-fetch without resetting state.
  const [refetchKey, setRefetchKey] = useState(0)

  // Capture whether fallbackData was provided at mount — it is a one-time seed
  // used to suppress the loading skeleton on first paint. Stored in a ref so the
  // fetch effect does not need opts.fallbackData in its dependency array (the
  // seeding decision is fixed at mount; we never re-apply it on subsequent renders).
  const hasFallbackRef = useRef(opts?.fallbackData !== undefined)

  useEffect(() => {
    if (!opts?.refetchOnFocus) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') setRefetchKey((k) => k + 1)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [opts?.refetchOnFocus])

  useEffect(() => {
    if (!opts?.refetchOnChannel) return
    if (typeof BroadcastChannel === 'undefined') return
    const ch = new BroadcastChannel(DATA_UPDATED_CHANNEL)
    ch.onmessage = () => setRefetchKey((k) => k + 1)
    return () => ch.close()
  }, [opts?.refetchOnChannel])

  useEffect(() => {
    if (!opts?.refetchInterval || opts.refetchInterval <= 0) return
    const id = setInterval(() => setRefetchKey((k) => k + 1), opts.refetchInterval)
    return () => clearInterval(id)
  }, [opts?.refetchInterval])

  useEffect(() => {
    // No path yet (route param not ready) — stay in loading idle.
    if (!path) return

    const resolvedPath = path
    let cancelled = false
    const isInitial = refetchKey === 0

    async function fetchData() {
      // Only show loading/skeleton on first fetch — background refetches update
      // data silently so the UI doesn't flash. Skip this reset when fallbackData
      // was provided (SSR seed): the UI already has real data so no skeleton needed.
      if (
        isInitial &&
        !(shouldCache(resolvedPath) && _cache.has(resolvedPath)) &&
        !hasFallbackRef.current
      ) {
        setData(null)
        setError(null)
        setNotFound(false)
        setLoading(true)
      }

      try {
        const result = await apiGet<T>(resolvedPath)
        if (!cancelled) {
          if (shouldCache(resolvedPath)) _cache.set(resolvedPath, result)
          setData(result)
          setError(null)
          setNotFound(false)
        }
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true)
        } else {
          setError(err instanceof Error ? err.message : 'An error occurred')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, [path, refetchKey])

  return { data, loading, error, notFound }
}
