// Public policy pages — mounted at /api/pages. Read-only; admin writes live at
// /api/admin/pages behind CF Access.

import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'
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

  return c.json(page)
})

export default app
