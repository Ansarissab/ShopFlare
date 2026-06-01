'use client'

import { useApiResource } from '@/hooks/useApiResource'
import type { StoreConfig } from '@/lib/types/store'
import type { UseStoreConfigResult } from '@/lib/types/store'

export function useStoreConfig(): UseStoreConfigResult {
  const { data, loading, error } = useApiResource<StoreConfig>('/api/config/store')
  return { config: data, loading, error }
}
