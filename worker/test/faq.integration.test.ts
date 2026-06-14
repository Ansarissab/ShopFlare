// Integration tests for Phase 30 FAQ feature.
// Covers:
//   - GET /api/config/store returns faqItems parsed from stored JSON
//   - Legacy faqContent migration fallback: derives faqItems when faqItems absent
//   - Admin PUT /api/admin/config/store persists faqItems as JSON, ignores faqContent
//   - Product create/update round-trips faqItems (string↔array)
//   - GET /api/products/:id returns faqItems as a parsed array

import { env, SELF } from 'cloudflare:test'
import { beforeEach, describe, expect, it } from 'vitest'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'

const db = () => createDb(env.DB)
const BASE = 'https://shop.test'

const get = (path: string) => SELF.fetch(`${BASE}${path}`)

const adminPost = (path: string, body: unknown) =>
  SELF.fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SAMPLE_FAQ_ITEMS = [
  { question: 'What is the return policy?', answer: 'You have 30 days to return any item.' },
  { question: 'Do you ship internationally?', answer: 'Yes, we ship worldwide.' },
]

// Trix-style HTML matching the sample items above — used for migration fallback tests.
const SAMPLE_FAQ_HTML =
  '<h3>What is the return policy?</h3><p>You have 30 days to return any item.</p>' +
  '<h3>Do you ship internationally?</h3><p>Yes, we ship worldwide.</p>'

async function insertConfigRow(key: string, value: string) {
  const now = new Date().toISOString()
  await db().insert(schema.storeConfig).values({ key, value, updatedAt: now })
}

// ─── GET /api/config/store — faqItems from stored JSON ───────────────────────

describe('GET /api/config/store - faqItems from stored JSON', () => {
  it('returns faqItems array when faqItems JSON is stored', async () => {
    await insertConfigRow('faqItems', JSON.stringify(SAMPLE_FAQ_ITEMS))

    const res = await get('/api/config/store')
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>

    expect(Array.isArray(body.faqItems)).toBe(true)
    const items = body.faqItems as typeof SAMPLE_FAQ_ITEMS
    expect(items).toHaveLength(2)
    expect(items[0].question).toBe('What is the return policy?')
    expect(items[0].answer).toBe('You have 30 days to return any item.')
    expect(items[1].question).toBe('Do you ship internationally?')
    expect(items[1].answer).toBe('Yes, we ship worldwide.')
  })

  it('filters out invalid faqItems entries and keeps valid ones', async () => {
    const mixed = [
      { question: 'Valid Q', answer: 'Valid A' },
      { question: '', answer: 'Missing question' }, // invalid — empty question fails faqItemSchema
      { notAQuestion: true }, // invalid — wrong shape
    ]
    await insertConfigRow('faqItems', JSON.stringify(mixed))

    const res = await get('/api/config/store')
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>

    // Only the one valid item survives filtering
    const items = body.faqItems as Array<{ question: string; answer: string }>
    expect(Array.isArray(items)).toBe(true)
    expect(items).toHaveLength(1)
    expect(items[0].question).toBe('Valid Q')
  })

  it('returns undefined faqItems when stored JSON is empty array', async () => {
    await insertConfigRow('faqItems', JSON.stringify([]))

    const res = await get('/api/config/store')
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>

    // Empty array → no valid items → undefined (not returned)
    expect(body.faqItems === undefined || body.faqItems === null).toBe(true)
  })
})

// ─── GET /api/config/store — legacy faqContent migration fallback ─────────────

describe('GET /api/config/store - legacy faqContent migration fallback', () => {
  it('derives faqItems from legacy faqContent HTML when faqItems row is absent', async () => {
    await insertConfigRow('faqContent', SAMPLE_FAQ_HTML)
    // faqItems row intentionally NOT inserted

    const res = await get('/api/config/store')
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>

    const items = body.faqItems as typeof SAMPLE_FAQ_ITEMS
    expect(Array.isArray(items)).toBe(true)
    expect(items).toHaveLength(2)
    expect(items[0].question).toBe('What is the return policy?')
    expect(items[1].question).toBe('Do you ship internationally?')
  })

  it('prefers stored faqItems over legacy faqContent when both exist', async () => {
    const storedItems = [{ question: 'Stored Q?', answer: 'Stored A.' }]
    await insertConfigRow('faqItems', JSON.stringify(storedItems))
    await insertConfigRow('faqContent', SAMPLE_FAQ_HTML)

    const res = await get('/api/config/store')
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>

    const items = body.faqItems as typeof storedItems
    expect(items).toHaveLength(1)
    expect(items[0].question).toBe('Stored Q?')
  })

  it('returns undefined faqItems when faqContent has no h3/h4 headings', async () => {
    await insertConfigRow('faqContent', '<p>No headings here — not parseable as FAQ.</p>')

    const res = await get('/api/config/store')
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>

    expect(body.faqItems === undefined || body.faqItems === null).toBe(true)
  })

  it('returns undefined faqItems when neither faqItems nor faqContent is stored', async () => {
    const res = await get('/api/config/store')
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>

    expect(body.faqItems === undefined || body.faqItems === null).toBe(true)
  })
})

// ─── PUT /api/admin/config/store — faqItems persistence ──────────────────────

describe('PUT /api/admin/config/store - faqItems persistence', () => {
  it('persists faqItems as serialized JSON', async () => {
    const res = await adminPut('/api/admin/config/store', { faqItems: SAMPLE_FAQ_ITEMS })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean; updated: string[] }
    expect(body.ok).toBe(true)
    expect(body.updated).toContain('faqItems')

    // Confirm D1 row is JSON-serialized (not "[object Object]")
    const allRows = await db().select().from(schema.storeConfig).all()
    const faqRow = allRows.find((r) => r.key === 'faqItems')
    expect(faqRow).toBeDefined()
    const parsed: unknown = JSON.parse(faqRow!.value)
    expect(Array.isArray(parsed)).toBe(true)
    expect((parsed as typeof SAMPLE_FAQ_ITEMS)[0].question).toBe('What is the return policy?')
  })

  it('does NOT write a faqContent row when faqContent is sent (deprecated)', async () => {
    await adminPut('/api/admin/config/store', {
      faqContent: SAMPLE_FAQ_HTML,
      faqItems: SAMPLE_FAQ_ITEMS,
    })

    // faqContent key must NOT be stored (admin route skips it on write)
    const allRows = await db().select().from(schema.storeConfig).all()
    const faqContentRow = allRows.find((r) => r.key === 'faqContent')
    expect(faqContentRow).toBeUndefined()
  })

  it('round-trips faqItems: PUT then GET returns same structured array', async () => {
    await adminPut('/api/admin/config/store', { faqItems: SAMPLE_FAQ_ITEMS })

    const res = await get('/api/config/store')
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>

    const items = body.faqItems as typeof SAMPLE_FAQ_ITEMS
    expect(items).toHaveLength(2)
    expect(items[0]).toEqual(SAMPLE_FAQ_ITEMS[0])
    expect(items[1]).toEqual(SAMPLE_FAQ_ITEMS[1])
  })

  it('overwrites existing faqItems on second PUT', async () => {
    await adminPut('/api/admin/config/store', {
      faqItems: [{ question: 'First Q?', answer: 'First A.' }],
    })
    await adminPut('/api/admin/config/store', {
      faqItems: [{ question: 'Second Q?', answer: 'Second A.' }],
    })

    const res = await get('/api/config/store')
    const body = (await res.json()) as Record<string, unknown>
    const items = body.faqItems as Array<{ question: string; answer: string }>
    expect(items).toHaveLength(1)
    expect(items[0].question).toBe('Second Q?')
  })
})

// ─── Product faqItems round-trip ──────────────────────────────────────────────

describe('Product faqItems round-trip', () => {
  it('POST /api/admin/products — creates product with faqItems and returns them', async () => {
    const res = await adminPost('/api/admin/products', {
      name: 'FAQ Product',
      faqItems: SAMPLE_FAQ_ITEMS,
    })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { id: string; faqItems: typeof SAMPLE_FAQ_ITEMS }
    expect(body.id).toBeTruthy()
    // The create response is the raw product row (faqItems is a JSON string in DB)
    // so we verify via GET
    const id = body.id

    const getRes = await get(`/api/products/${id}`)
    expect(getRes.status).toBe(200)
    const product = (await getRes.json()) as {
      product: { name: string }
      faqItems: typeof SAMPLE_FAQ_ITEMS
    }
    expect(Array.isArray(product.faqItems)).toBe(true)
    expect(product.faqItems).toHaveLength(2)
    expect(product.faqItems[0].question).toBe('What is the return policy?')
    expect(product.faqItems[1].question).toBe('Do you ship internationally?')
  })

  it('PUT /api/admin/products/:id — updates faqItems and GET reflects new array', async () => {
    const createRes = await adminPost('/api/admin/products', {
      name: 'Update FAQ Product',
      faqItems: [{ question: 'Original Q?', answer: 'Original A.' }],
    })
    expect(createRes.status).toBe(201)
    const { id } = (await createRes.json()) as { id: string }

    const updatedItems = [
      { question: 'Updated Q?', answer: 'Updated A.' },
      { question: 'New Q?', answer: 'New A.' },
    ]
    const putRes = await adminPut(`/api/admin/products/${id}`, { faqItems: updatedItems })
    expect(putRes.status).toBe(200)

    const getRes = await get(`/api/products/${id}`)
    expect(getRes.status).toBe(200)
    const product = (await getRes.json()) as {
      faqItems: typeof updatedItems
    }
    expect(product.faqItems).toHaveLength(2)
    expect(product.faqItems[0].question).toBe('Updated Q?')
    expect(product.faqItems[1].question).toBe('New Q?')
  })

  it('GET /api/products/:id — returns empty faqItems array when none stored', async () => {
    const createRes = await adminPost('/api/admin/products', { name: 'No FAQ Product' })
    expect(createRes.status).toBe(201)
    const { id } = (await createRes.json()) as { id: string }

    const getRes = await get(`/api/products/${id}`)
    expect(getRes.status).toBe(200)
    const product = (await getRes.json()) as { faqItems: unknown }
    expect(Array.isArray(product.faqItems)).toBe(true)
    expect((product.faqItems as unknown[]).length).toBe(0)
  })
})
