import { describe, it, expect } from 'vitest'
import { isFeatureEnabled } from 'worker/lib/features'
import { FEATURE_FLAGS } from '@/lib/constants'

describe('worker/lib/features — isFeatureEnabled', () => {
  it('returns default when config is null', () => {
    expect(isFeatureEnabled(null, 'reviewsEnabled')).toBe(FEATURE_FLAGS.reviewsEnabled)
  })

  it('returns config value when set', () => {
    expect(isFeatureEnabled({ reviewsEnabled: false }, 'reviewsEnabled')).toBe(false)
    expect(isFeatureEnabled({ whatsappEnabled: true }, 'whatsappEnabled')).toBe(true)
  })

  it('falls back to default when key absent in config', () => {
    expect(isFeatureEnabled({}, 'reviewsEnabled')).toBe(true)
  })
})
