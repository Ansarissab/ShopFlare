import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { createDb } from '../db/index'
import * as schema from '../db/schema'
import { storeConfigSchema } from '@/lib/schemas'
import type { StoreConfigData } from '@/lib/schemas'
import type { Bindings } from '../types'

const app = new Hono<{ Bindings: Bindings }>()

// Keys stored in the storeConfig table
const CONFIG_KEYS = [
  'storeName',
  'tagline',
  'whatsappNumber',
  'contactEmail',
  'currency',
  'freeShippingThresholdCents',
  'flatShippingRateCents',
] as const

// ─── GET /store ───────────────────────────────────────────────────────────────

app.get('/store', async (c) => {
  const db = createDb(c.env.DB)

  const rows = await db
    .select()
    .from(schema.storeConfig)
    .all()

  // Build a key→value map from rows
  const kv: Record<string, string> = {}
  for (const row of rows) {
    kv[row.key] = row.value
  }

  // Assemble StoreConfigData with fallbacks
  const assembled: StoreConfigData = {
    storeName:                  kv['storeName']  ?? 'Store',
    tagline:                    kv['tagline']     ?? undefined,
    whatsappNumber:             kv['whatsappNumber'] ?? undefined,
    contactEmail:               kv['contactEmail']   ?? undefined,
    currency:                   (kv['currency'] as StoreConfigData['currency']) ?? 'PKR',
    freeShippingThresholdCents: Number(kv['freeShippingThresholdCents'] ?? '0'),
    flatShippingRateCents:      Number(kv['flatShippingRateCents']      ?? '0'),
  }

  // Validate — log on failure but still return best-effort data
  const result = storeConfigSchema.safeParse(assembled)
  if (!result.success) {
    console.warn('[config/store] assembled config failed validation', result.error.issues)
  }

  return c.json(assembled)
})

// ─── GET /theme — Phase 2 stub ────────────────────────────────────────────────

app.get('/theme', (c) => c.json({ todo: 'theme — Phase 2' }))

// ─── PUT /store — Phase 2 stub ────────────────────────────────────────────────

app.put('/store', (c) => c.json({ todo: 'update store config — Phase 2' }))

export default app
