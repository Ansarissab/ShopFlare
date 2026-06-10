'use client'

// Generic data-fetching hook that encapsulates the repeated useState/useEffect/
// apiGet/ApiError scaffolding found across store pages.
//
// Null-path semantics: when `path` is null (or empty), the hook stays in
// { loading: true } indefinitely — it never transitions to loading=false until
// a real path is provided. This matches the existing page behaviour where pages
// guard on `params?.slug` / `params?.orderId` inside their own useEffect and
// simply return the skeleton while the router is still hydrating the params.

import { useEffect, useState } from 'react'
import { apiGet, ApiError } from '@/lib/api'
import type { ApiResourceState } from '@/lib/types/common'

export type { ApiResourceState }

// Shared BroadcastChannel name for cross-tab data invalidation.
// Post any message to this channel to trigger a silent re-fetch in all
// subscribers (useApiResource with refetchOnChannel + useStoreConfig).
export const DATA_UPDATED_CHANNEL = 'shopflare:data-updated'

export interface UseApiResourceOptions {
  // Re-fetch silently when the browser tab regains focus. Use for data that
  // can change in another tab or context (e.g. store config).
  refetchOnFocus?: boolean
  // Re-fetch silently whenever a message arrives on DATA_UPDATED_CHANNEL.
  refetchOnChannel?: boolean
  // Re-fetch in the background every N milliseconds (e.g. 60_000 for 60 s).
  refetchInterval?: number
}

const _cache = new Map<string, unknown>()

// Only cache read-only public content — never transactional/order paths.
const shouldCache = (path: string) => !path.startsWith('/api/orders')

export function useApiResource<T>(
  path: string | null,
  opts?: UseApiResourceOptions,
): ApiResourceState<T> {
  const [data, setData] = useState<T | null>(() =>
    path && shouldCache(path) && _cache.has(path) ? (_cache.get(path) as T) : null,
  )
  const [loading, setLoading] = useState(() =>
    path ? !(shouldCache(path) && _cache.has(path)) : true,
  )
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  // Bump to trigger a silent background re-fetch without resetting state.
  const [refetchKey, setRefetchKey] = useState(0)

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
      // data silently so the UI doesn't flash.
      if (isInitial && !(shouldCache(resolvedPath) && _cache.has(resolvedPath))) {
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
