'use client'

import { useApiResource, DATA_UPDATED_CHANNEL } from '@/hooks/useApiResource'
import type { StoreConfig, UseStoreConfigResult } from '@/lib/types/common'

// Kept for backward compatibility — aliased to the shared DATA_UPDATED_CHANNEL.
export const CONFIG_BROADCAST_CHANNEL = DATA_UPDATED_CHANNEL

// Config rarely changes and many chrome components read it every page. Riding the
// shared useApiResource cache → one fetch per session (served from cache after),
// hydration reads coalesced, background-revalidated; focus/channel pick up admin edits.
export function useStoreConfig(): UseStoreConfigResult {
  const { data, loading, error } = useApiResource<StoreConfig>('/api/config/store', {
    refetchOnFocus: true,
    refetchOnChannel: true,
  })
  return { config: data, loading, error }
}
