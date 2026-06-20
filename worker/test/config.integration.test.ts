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

describe('GET /api/config/store - i18n locale fields', () => {
  it('returns default enabledLocales and defaultLocale when unset', async () => {
    const res = await get('/api/config/store')
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.enabledLocales).toEqual(['en'])
    expect(body.defaultLocale).toBe('en')
  })

  it('round-trips enabledLocales and defaultLocale via PUT then GET (order preserved)', async () => {
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
    // enabledLocales is stored comma-joined, re-parsed as array — order must be preserved
    expect(body.enabledLocales).toEqual(['en', 'fr', 'ur'])
    expect(body.defaultLocale).toBe('fr')
  })

  it('rejects PUT with enabledLocales that omits en (400)', async () => {
    const res = await adminPut('/api/admin/config/store', {
      enabledLocales: ['fr'],
    })
    expect(res.status).toBe(400)
  })

  it('rejects PUT where defaultLocale is not in enabledLocales (400)', async () => {
    const res = await adminPut('/api/admin/config/store', {
      enabledLocales: ['en'],
      defaultLocale: 'ur',
    })
    expect(res.status).toBe(400)
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

// ─── Announcement config round-trip ──────────────────────────────────────────

describe('GET /api/config/store - announcement fields', () => {
  it('returns undefined announcement fields when unset', async () => {
    const res = await get('/api/config/store')
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    // Unset fields should be absent or undefined (not crash)
    expect(body.announcementEnabled === false || body.announcementEnabled === undefined).toBe(true)
  })
})

describe('PUT /api/admin/config/store - announcement config', () => {
  it('round-trips announcement config: messages array survives JSON serialization', async () => {
    const messages = [
      { text: 'Free shipping on orders above Rs 3000', link: '/shop', color: '#1A1A18' },
      { text: 'Sale ends Sunday' },
    ]

    const putRes = await adminPut('/api/admin/config/store', {
      announcementEnabled: true,
      announcementType: 'rotating',
      announcementMessages: messages,
      announcementVersion: 2,
    })
    expect(putRes.status).toBe(200)
    const putBody = (await putRes.json()) as { ok: boolean; updated: string[] }
    expect(putBody.ok).toBe(true)
    expect(putBody.updated).toContain('announcementMessages')
    expect(putBody.updated).toContain('announcementEnabled')
    expect(putBody.updated).toContain('announcementVersion')

    // GET should reflect stored values
    const res = await get('/api/config/store')
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>

    expect(body.announcementEnabled).toBe(true)
    expect(body.announcementType).toBe('rotating')
    expect(body.announcementVersion).toBe(2)

    // Messages array survives round-trip as parsed objects (not "[object Object]")
    const storedMessages = body.announcementMessages as typeof messages
    expect(Array.isArray(storedMessages)).toBe(true)
    expect(storedMessages).toHaveLength(2)
    expect(storedMessages[0].text).toBe('Free shipping on orders above Rs 3000')
    expect(storedMessages[0].link).toBe('/shop')
    expect(storedMessages[0].color).toBe('#1A1A18')
    expect(storedMessages[1].text).toBe('Sale ends Sunday')
  })

  it('round-trips single-message announcement with scheduled window', async () => {
    const putRes = await adminPut('/api/admin/config/store', {
      announcementEnabled: true,
      announcementType: 'scheduled',
      announcementMessages: [{ text: 'Holiday sale' }],
      announcementStart: '2026-12-24T00:00:00.000Z',
      announcementEnd: '2026-12-26T23:59:59.000Z',
      announcementVersion: 1,
    })
    expect(putRes.status).toBe(200)

    const res = await get('/api/config/store')
    const body = (await res.json()) as Record<string, unknown>

    expect(body.announcementType).toBe('scheduled')
    expect(body.announcementStart).toBe('2026-12-24T00:00:00.000Z')
    expect(body.announcementEnd).toBe('2026-12-26T23:59:59.000Z')
    const msgs = body.announcementMessages as Array<{ text: string }>
    expect(msgs[0].text).toBe('Holiday sale')
  })

  it('upserts announcement version - second PUT increments', async () => {
    await adminPut('/api/admin/config/store', {
      announcementVersion: 3,
      announcementMessages: [{ text: 'v3' }],
    })
    await adminPut('/api/admin/config/store', {
      announcementVersion: 4,
      announcementMessages: [{ text: 'v4' }],
    })

    const res = await get('/api/config/store')
    const body = (await res.json()) as Record<string, unknown>
    expect(body.announcementVersion).toBe(4)
    const msgs = body.announcementMessages as Array<{ text: string }>
    expect(msgs[0].text).toBe('v4')
  })
})
