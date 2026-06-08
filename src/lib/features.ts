import { FEATURE_FLAGS } from '@/lib/constants'
import type { FeatureFlagKey } from '@/lib/constants'
import type { StoreConfigData } from '@/lib/schemas/config'

export function isFeatureEnabled(
  config: Pick<StoreConfigData, FeatureFlagKey> | null | undefined,
  key: FeatureFlagKey,
): boolean {
  return config?.[key] ?? FEATURE_FLAGS[key]
}
