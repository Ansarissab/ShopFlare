// Public config route — mounted at /api/config. Read-only; the admin
// PUT /store (config editor) lives on /api/admin/config behind CF Access.

import { Hono } from 'hono'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import { storeConfigSchema } from '@/lib/schemas'
import type { StoreConfigData } from '@/lib/schemas'
import type { Bindings } from 'worker/types'

const app = new Hono<{ Bindings: Bindings }>()

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
  // Use `|| undefined` for optional fields so an EMPTY stored value ('') reads
  // as "unset" rather than failing the optional phone/email/string validators
  // (an empty whatsappNumber/contactEmail is not a malformed one).
  const assembled: StoreConfigData = {
    storeName:                  kv['storeName']  || 'ShopFlare',
    tagline:                    kv['tagline']     || undefined,
    whatsappNumber:             kv['whatsappNumber'] || undefined,
    contactEmail:               kv['contactEmail']   || undefined,
    currency:                   (kv['currency'] as StoreConfigData['currency']) || 'PKR',
    freeShippingThresholdCents: Number(kv['freeShippingThresholdCents'] ?? '0'),
    flatShippingRateCents:      Number(kv['flatShippingRateCents']      ?? '0'),
    bankName:          kv['bankName']          || undefined,
    bankAccountTitle:  kv['bankAccountTitle']  || undefined,
    bankAccountNumber: kv['bankAccountNumber'] || undefined,
    bankIban:          kv['bankIban']          || undefined,
    bankInstructions:  kv['bankInstructions']  || undefined,
  }

  // Validate — log on failure but still return best-effort data
  const result = storeConfigSchema.safeParse(assembled)
  if (!result.success) {
    console.warn('[config/store] assembled config failed validation', result.error.issues)
  }

  return c.json(assembled, 200, {
    'Cache-Control': 'no-store',
  })
})

export default app
