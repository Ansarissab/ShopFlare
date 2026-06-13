// Integration tests for config routes:
//   GET  /api/public-config   — safe env bindings for frontend
//   GET  /api/config/store    — assembled store config with defaults
//   PUT  /api/admin/config/store — upsert store config keys

import { env, SELF } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'

const db = () => createDb(env.DB)
const BASE = 'https://shop.test'

const get = (path: string) => SELF.fetch(`${BASE}${path}`)

const adminPut = (path: string, body: unknown) =>
  SELF.fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

// ─── Cleanup ──────────────────────────────────────────────────────────────────

const TABLES = [
  'coupon_uses',
  'reviews',
  'notify_me',
  'order_items',
  'orders',
  'coupons',
  'size_options',
  'product_images',
  'variants',
  'products',
  'store_config',
  'stripe_events',
  'push_subscriptions',
  'analytics_daily',
  'carts',
]
beforeEach(async () => {
  for (const t of TABLES) await env.DB.prepare(`DELETE FROM ${t}`).run()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/public-config', () => {
  it('returns safe env bindings only', async () => {
    const res = await get('/api/public-config')
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body).toHaveProperty('stripePublishableKey')
    expect(body).toHaveProperty('turnstileSiteKey')
    expect(body).toHaveProperty('vapidPublicKey')
  })

  it('never exposes secret keys', async () => {
    const res = await get('/api/public-config')
    const body = (await res.json()) as Record<string, unknown>
    expect(body).not.toHaveProperty('stripeSecretKey')
    expect(body).not.toHaveProperty('STRIPE_SECRET_KEY')
    expect(body).not.toHaveProperty('vapidPrivateKey')
  })
})

describe('GET /api/config/store', () => {
  it('returns defaults when store_config table is empty', async () => {
    const res = await get('/api/config/store')
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.storeName).toBe('ShopFlare')
    expect(body.currency).toBe('PKR')
    expect(body.primaryColor).toBe('#1A1A18')
    expect(body.accentColor).toBe('#4A7C6F')
    expect(body.radius).toBe('md')
    expect(body.fontFamily).toBe('sans')
    expect(body.colorMode).toBe('light')
  })

  it('reflects stored config values', async () => {
    const now = new Date().toISOString()
    await db()
      .insert(schema.storeConfig)
      .values([
        { key: 'storeName', value: 'My Shop', updatedAt: now },
        { key: 'tagline', value: 'The best shop', updatedAt: now },
        { key: 'currency', value: 'USD', updatedAt: now },
      ])

    const res = await get('/api/config/store')
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.storeName).toBe('My Shop')
    expect(body.tagline).toBe('The best shop')
    expect(body.currency).toBe('USD')
  })

  it('returns an ETag header', async () => {
    const res = await get('/api/config/store')
    expect(res.headers.get('etag')).toBeTruthy()
  })

  it('responds 304 when ETag matches (not-modified)', async () => {
    const r1 = await get('/api/config/store')
    const etag = r1.headers.get('etag')!
    expect(etag).toBeTruthy()

    const r2 = await SELF.fetch(`${BASE}/api/config/store`, {
      headers: { 'If-None-Match': etag },
    })
    expect(r2.status).toBe(304)
  })

  it('ETag changes after config update', async () => {
    const r1 = await get('/api/config/store')
    const etag1 = r1.headers.get('etag')

    await adminPut('/api/admin/config/store', { storeName: 'Updated Shop' })

    const r2 = await get('/api/config/store')
    const etag2 = r2.headers.get('etag')

    expect(etag1).toBeTruthy()
    expect(etag2).toBeTruthy()
    expect(etag1).not.toBe(etag2)
  })
})

describe('GET /api/config/store — i18n locale fields', () => {
  it('returns default enabledLocales and defaultLocale when unset', async () => {
    const res = await get('/api/config/store')
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.enabledLocales).toEqual(['en'])
    expect(body.defaultLocale).toBe('en')
  })

  it('round-trips enabledLocales and defaultLocale via PUT then GET', async () => {
    const putRes = await adminPut('/api/admin/config/store', {
      enabledLocales: ['en', 'fr', 'ur'],
      defaultLocale: 'fr',
    })
    expect(putRes.status).toBe(200)
    const putBody = (await putRes.json()) as { ok: boolean; updated: string[] }
    expect(putBody.ok).toBe(true)
    expect(putBody.updated).toContain('enabledLocales')
    expect(putBody.updated).toContain('defaultLocale')

    const res = await get('/api/config/store')
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    // enabledLocales is stored comma-joined, re-parsed as array
    expect(body.enabledLocales).toEqual(['en', 'fr', 'ur'])
    expect(body.defaultLocale).toBe('fr')
  })
})

describe('PUT /api/admin/config/store', () => {
  it('creates new config keys and returns updated list', async () => {
    const res = await adminPut('/api/admin/config/store', {
      storeName: 'Test Store',
      tagline: 'Best deals',
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; updated: string[] }
    expect(body.ok).toBe(true)
    expect(body.updated).toContain('storeName')
    expect(body.updated).toContain('tagline')
  })

  it('persists values - subsequent GET /api/config/store reflects them', async () => {
    await adminPut('/api/admin/config/store', { storeName: 'Persisted Store', currency: 'USD' })

    const res = await get('/api/config/store')
    const body = (await res.json()) as Record<string, unknown>
    expect(body.storeName).toBe('Persisted Store')
    expect(body.currency).toBe('USD')
  })

  it('upserts: second PUT overwrites the first', async () => {
    await adminPut('/api/admin/config/store', { storeName: 'First Name' })
    await adminPut('/api/admin/config/store', { storeName: 'Second Name' })

    const res = await get('/api/config/store')
    const body = (await res.json()) as Record<string, unknown>
    expect(body.storeName).toBe('Second Name')
  })

  it('rejects invalid payload (400)', async () => {
    const res = await adminPut('/api/admin/config/store', { currency: 'INVALID_CODE' })
    expect(res.status).toBe(400)
  })

  it('updates boolean tax flags correctly', async () => {
    await adminPut('/api/admin/config/store', {
      taxEnabled: true,
      taxRate: 17,
      taxName: 'GST',
      taxInclusive: false,
    })

    const res = await get('/api/config/store')
    const body = (await res.json()) as Record<string, unknown>
    expect(body.taxEnabled).toBe(true)
    expect(body.taxRate).toBe(17)
    expect(body.taxName).toBe('GST')
    expect(body.taxInclusive).toBe(false)
  })
})
