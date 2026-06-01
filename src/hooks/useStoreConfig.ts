'use client'

import { useState, useEffect } from 'react'
import { apiGet } from '@/lib/api'
import type { StoreConfig } from '@/lib/types/store'

interface UseStoreConfigResult {
  config: StoreConfig | null
  loading: boolean
}

export function useStoreConfig(): UseStoreConfigResult {
  const [config, setConfig] = useState<StoreConfig | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    apiGet<StoreConfig>('/api/config/store')
      .then((data) => {
        if (!cancelled) setConfig(data)
      })
      .catch(() => {
        // Errors are swallowed — config stays null
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { config, loading }
}
