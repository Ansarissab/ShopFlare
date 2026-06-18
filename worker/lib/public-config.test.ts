import { describe, expect, it, vi } from 'vitest'
import { buildPublicConfig, publishableKeyOnly } from './public-config'

describe('publishableKeyOnly', () => {
  it('passes a publishable key through unchanged', () => {
    expect(publishableKeyOnly('pk_test_abc123')).toBe('pk_test_abc123')
    expect(publishableKeyOnly('pk_live_xyz')).toBe('pk_live_xyz')
  })

  it('refuses (blanks) a Stripe secret key and logs', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(publishableKeyOnly('sk_test_51TYLH4')).toBe('')
    expect(publishableKeyOnly('sk_live_secret')).toBe('')
    expect(publishableKeyOnly('rk_test_restricted')).toBe('')
    expect(err).toHaveBeenCalledTimes(3)
    err.mockRestore()
  })

  it('returns empty for missing values', () => {
    expect(publishableKeyOnly(undefined)).toBe('')
    expect(publishableKeyOnly(null)).toBe('')
    expect(publishableKeyOnly('')).toBe('')
  })
})

describe('buildPublicConfig', () => {
  it('maps the safe public keys', () => {
    expect(
      buildPublicConfig({
        STRIPE_PUBLISHABLE_KEY: 'pk_test_1',
        TURNSTILE_SITE_KEY: '0x_site',
        VAPID_PUBLIC_KEY: 'vapid_pub',
      }),
    ).toEqual({
      stripePublishableKey: 'pk_test_1',
      turnstileSiteKey: '0x_site',
      vapidPublicKey: 'vapid_pub',
    })
  })

  it('never emits a misconfigured Stripe secret key', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const cfg = buildPublicConfig({ STRIPE_PUBLISHABLE_KEY: 'sk_live_oops' })
    expect(cfg.stripePublishableKey).toBe('')
    err.mockRestore()
  })

  it('defaults absent keys to empty strings', () => {
    expect(buildPublicConfig({})).toEqual({
      stripePublishableKey: '',
      turnstileSiteKey: '',
      vapidPublicKey: '',
    })
  })
})
