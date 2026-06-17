// Public landing route — GET /api/landing
// Returns assembled landing sections + featured product list.
// Gated by landingEnabled flag: returns 404 when the feature is off.

import { Hono } from 'hono'
import { eq, asc } from 'drizzle-orm'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import { isFeatureEnabled } from 'worker/lib/features'
import { resolveActivePage } from 'worker/lib/landing'
import type { Bindings } from 'worker/types'
import { LANDING_SECTION_KEYS } from '@/lib/constants'
import type { LandingSectionKey } from '@/lib/constants'

const app = new Hono<{ Bindings: Bindings }>()

// ─── GET / — assembled landing data ──────────────────────────────────────────

app.get('/', async (c) => {
  const db = createDb(c.env.DB)

  const configRows = await db.select().from(schema.storeConfig).all()
  const kv = Object.fromEntries(configRows.map((r) => [r.key, r.value]))
  const landingEnabled =
    kv['landingEnabled'] !== undefined ? kv['landingEnabled'] === 'true' : false

  if (!isFeatureEnabled({ landingEnabled }, 'landingEnabled')) {
    return c.json({ error: 'Landing page is not enabled' }, 404)
  }

  const activePage = await resolveActivePage(db)
  if (activePage === null) {
    return c.json({ error: 'Landing page is not enabled' }, 404)
  }
  const pageId = activePage.id

  const [sectionRows, featuredRows] = await Promise.all([
    db
      .select()
      .from(schema.landingContent)
      .where(eq(schema.landingContent.landingPageId, pageId))
      .all(),
    db
      .select()
      .from(schema.featuredProducts)
      .where(eq(schema.featuredProducts.landingPageId, pageId))
      .orderBy(asc(schema.featuredProducts.sortOrder))
      .all(),
  ])

  const sections = Object.fromEntries(
    LANDING_SECTION_KEYS.map((key) => {
      const row = sectionRows.find((r) => r.sectionKey === key)
      return [
        key,
        {
          sectionKey: key as LandingSectionKey,
          enabled: row?.enabled ?? true,
          heading: row?.heading ?? null,
          subtext: row?.subtext ?? null,
          bodyHtml: row?.bodyHtml ?? null,
          ctaText: row?.ctaText ?? null,
          ctaHref: row?.ctaHref ?? null,
          imageR2Key: row?.imageR2Key ?? null,
          updatedAt: row?.updatedAt ?? '',
        },
      ]
    }),
  )

  return c.json({
    template: activePage.template,
    sections,
    featuredProductIds: featuredRows.map((r) => r.productId),
  })
})

export default app
