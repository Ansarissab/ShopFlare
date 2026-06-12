// Public config route — mounted at /api/config. Read-only; the admin
// PUT /store (config editor) lives on /api/admin/config behind CF Access.

import { Hono } from 'hono'
import { sql } from 'drizzle-orm'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import { storeConfigSchema } from '@/lib/schemas'
import type { StoreConfigData } from '@/lib/schemas'
import type { Bindings } from 'worker/types'
import { etagFor } from 'worker/lib/fingerprint'

const app = new Hono<{ Bindings: Bindings }>()

// ─── GET /store ───────────────────────────────────────────────────────────────

app.get('/store', async (c) => {
  const db = createDb(c.env.DB)

  // ETag: count + max(updated_at) of store_config rows.
  // bumpDataVersion() updates the dataVersion row's updated_at on every admin
  // write, so this fingerprint changes whenever config OR any data changes.
  const stats = await db
    .select({
      count: sql<number>`COUNT(*)`,
      maxUpdatedAt: sql<string>`MAX(updated_at)`,
    })
    .from(schema.storeConfig)
    .get()

  const etag = etagFor({
    count: stats?.count ?? 0,
    maxUpdatedAt: stats?.maxUpdatedAt ?? '',
  })

  if (c.req.header('If-None-Match') === etag) {
    return c.newResponse(null, 304)
  }

  const rows = await db.select().from(schema.storeConfig).all()

  const kv: Record<string, string> = {}
  for (const row of rows) {
    kv[row.key] = row.value
  }

  // Use `|| undefined` for optional fields so an EMPTY stored value ('') reads
  // as "unset" rather than failing the optional phone/email/string validators.
  const assembled: StoreConfigData = {
    storeName: kv['storeName'] || 'ShopFlare',
    tagline: kv['tagline'] || undefined,
    whatsappNumber: kv['whatsappNumber'] || undefined,
    contactEmail: kv['contactEmail'] || undefined,
    currency: (kv['currency'] as StoreConfigData['currency']) || 'PKR',
    freeShippingThresholdCents: Number(kv['freeShippingThresholdCents'] ?? '0'),
    flatShippingRateCents: Number(kv['flatShippingRateCents'] ?? '0'),
    bankName: kv['bankName'] || undefined,
    bankAccountTitle: kv['bankAccountTitle'] || undefined,
    bankAccountNumber: kv['bankAccountNumber'] || undefined,
    bankIban: kv['bankIban'] || undefined,
    bankInstructions: kv['bankInstructions'] || undefined,
    primaryColor: kv['primaryColor'] || '#1A1A18',
    primaryColorFg: kv['primaryColorFg'] || undefined,
    accentColor: kv['accentColor'] || '#4A7C6F',
    accentColorFg: kv['accentColorFg'] || undefined,
    radius: (kv['radius'] as StoreConfigData['radius']) || 'md',
    fontFamily: (kv['fontFamily'] as StoreConfigData['fontFamily']) || 'sans',
    colorMode: (kv['colorMode'] as StoreConfigData['colorMode']) || 'light',
    density: (kv['density'] as StoreConfigData['density']) || 'comfortable',
    heroStyle: (kv['heroStyle'] as StoreConfigData['heroStyle']) || 'image-left',
    logoUrl: kv['logoUrl'] || undefined,
    logoR2Key: kv['logoR2Key'] || undefined,
    faviconUrl: kv['faviconUrl'] || undefined,
    faviconR2Key: kv['faviconR2Key'] || undefined,
    taxEnabled: kv['taxEnabled'] === 'true',
    taxRate: Number(kv['taxRate'] ?? '0') || 0,
    taxName: kv['taxName'] || 'Tax',
    taxInclusive: kv['taxInclusive'] === 'true',
    taxBasis: kv['taxBasis'] || 'subtotal',
    taxRegistrationNumber: kv['taxRegistrationNumber'] || undefined,
    productPageSize: kv['productPageSize'] ? Number(kv['productPageSize']) : undefined,
    // Feature flags — default from FEATURE_FLAGS constants when not stored.
    whatsappEnabled: kv['whatsappEnabled'] !== undefined ? kv['whatsappEnabled'] === 'true' : false,
    reviewsEnabled: kv['reviewsEnabled'] !== undefined ? kv['reviewsEnabled'] === 'true' : true,
    landingEnabled: kv['landingEnabled'] !== undefined ? kv['landingEnabled'] === 'true' : false,
    blogEnabled: kv['blogEnabled'] !== undefined ? kv['blogEnabled'] === 'true' : false,
    llmDiscoveryEnabled:
      kv['llmDiscoveryEnabled'] !== undefined ? kv['llmDiscoveryEnabled'] === 'true' : true,
    faqEnabled: kv['faqEnabled'] !== undefined ? kv['faqEnabled'] === 'true' : false,
    faqContent: kv['faqContent'] || undefined,
    aiTrainingAllowed:
      kv['aiTrainingAllowed'] !== undefined ? kv['aiTrainingAllowed'] === 'true' : true,
  }

  const validation = storeConfigSchema.safeParse(assembled)
  if (!validation.success) {
    console.warn('[config/store] assembled config failed validation', validation.error.issues)
  }

  return c.json(assembled, 200, {
    'Cache-Control': 'no-cache, stale-while-revalidate=60',
    ETag: etag,
  })
})

export default app
