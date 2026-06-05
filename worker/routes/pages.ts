// Public policy pages — mounted at /api/pages. Read-only; admin writes live at
// /api/admin/pages behind CF Access.

import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import { etagFor } from 'worker/lib/fingerprint'
import { getDataVersion } from 'worker/lib/version'
import type { Bindings } from 'worker/types'
import { POLICY_SLUGS } from '@/lib/constants'

const app = new Hono<{ Bindings: Bindings }>()

app.get('/:slug', async (c) => {
  const slug = c.req.param('slug')

  if (!(POLICY_SLUGS as readonly string[]).includes(slug)) return c.notFound()

  const db = createDb(c.env.DB)

  const [page] = await db
    .select()
    .from(schema.pages)
    .where(eq(schema.pages.slug, slug))
    .limit(1)

  if (!page) return c.notFound()

  const version = await getDataVersion(db)
  const etag = etagFor({ count: 1, maxUpdatedAt: page.updatedAt, version })

  const cacheControl = 'public, max-age=300, s-maxage=3600, stale-while-revalidate=600'

  if (c.req.header('If-None-Match') === etag) {
    return c.newResponse(null, 304, { 'Cache-Control': cacheControl, 'ETag': etag })
  }

  return c.json(page, 200, {
    'Cache-Control': cacheControl,
    'ETag': etag,
  })
})

export default app
