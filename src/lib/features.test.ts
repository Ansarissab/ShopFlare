import { describe, it, expect } from 'vitest'
import { isFeatureEnabled } from '@/lib/features'
import { FEATURE_FLAGS } from '@/lib/constants'

describe('isFeatureEnabled', () => {
  it('returns default when config null', () => {
    expect(isFeatureEnabled(null, 'reviewsEnabled')).toBe(FEATURE_FLAGS.reviewsEnabled)
    expect(isFeatureEnabled(null, 'whatsappEnabled')).toBe(FEATURE_FLAGS.whatsappEnabled)
  })

  it('returns default when config undefined', () => {
    expect(isFeatureEnabled(undefined, 'blogEnabled')).toBe(false)
    expect(isFeatureEnabled(undefined, 'llmDiscoveryEnabled')).toBe(true)
  })

  it('returns config value when set to true', () => {
    expect(isFeatureEnabled({ whatsappEnabled: true }, 'whatsappEnabled')).toBe(true)
  })

  it('returns config value when set to false', () => {
    expect(isFeatureEnabled({ reviewsEnabled: false }, 'reviewsEnabled')).toBe(false)
  })

  it('falls back to default when key undefined in config', () => {
    expect(isFeatureEnabled({}, 'landingEnabled')).toBe(false)
    expect(isFeatureEnabled({}, 'reviewsEnabled')).toBe(true)
  })
})
