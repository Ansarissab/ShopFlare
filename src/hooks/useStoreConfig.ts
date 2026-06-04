'use client'

import { useEffect, useCallback, useState } from 'react'
import { apiGet } from '@/lib/api'
import { DATA_UPDATED_CHANNEL } from '@/hooks/useApiResource'
import type { StoreConfig, UseStoreConfigResult } from '@/lib/types/common'

// Kept for backward compatibility — aliased to the shared DATA_UPDATED_CHANNEL.
export const CONFIG_BROADCAST_CHANNEL = DATA_UPDATED_CHANNEL

export function useStoreConfig(): UseStoreConfigResult {
  const [config, setConfig] = useState<StoreConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchConfig = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true)
    try {
      const data = await apiGet<StoreConfig>('/api/config/store')
      setConfig(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load config')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch
  useEffect(() => { fetchConfig(true) }, [fetchConfig])

  // Refetch when tab regains focus (covers same-browser tab switching)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchConfig()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [fetchConfig])

  // Refetch when admin saves config in any tab via BroadcastChannel
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const ch = new BroadcastChannel(DATA_UPDATED_CHANNEL)
    ch.onmessage = () => fetchConfig()
    return () => ch.close()
  }, [fetchConfig])

  return { config, loading, error }
}
