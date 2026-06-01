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

export interface ApiResourceState<T> {
  data: T | null
  loading: boolean
  error: string | null
  notFound: boolean
}

export function useApiResource<T>(path: string | null): ApiResourceState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    // No path yet (route param not ready) — stay in loading idle.
    if (!path) return

    const resolvedPath = path
    let cancelled = false

    async function fetchData() {
      // Reset derived state when path changes.
      setData(null)
      setError(null)
      setNotFound(false)
      setLoading(true)

      try {
        const result = await apiGet<T>(resolvedPath)
        if (!cancelled) setData(result)
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
  }, [path])

  return { data, loading, error, notFound }
}
