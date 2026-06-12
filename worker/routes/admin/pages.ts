// Admin policy pages — mounted under /api/admin/pages, behind requireAdmin.

import { Hono } from 'hono'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import { updatePageSchema } from '@/lib/schemas'
import { parseBody } from 'worker/lib/http'
import { sanitizeHtml } from 'worker/lib/sanitize'
import { bumpDataVersion } from 'worker/lib/version'
import type { AdminEnv } from 'worker/lib/access'
import { POLICY_SLUGS } from '@/lib/constants'

const app = new Hono<AdminEnv>()

// ─── GET / — list all policy pages ───────────────────────────────────────────

app.get('/', async (c) => {
  const db = createDb(c.env.DB)
  const rows = await db.select().from(schema.pages).all()
  return c.json({ pages: rows })
})

// ─── PUT /:slug — upsert a policy page ───────────────────────────────────────

app.put('/:slug', async (c) => {
  const slug = c.req.param('slug')

  if (!(POLICY_SLUGS as readonly string[]).includes(slug)) {
    return c.json({ error: 'Invalid policy slug' }, 400)
  }

  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = updatePageSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const db = createDb(c.env.DB)
  const now = new Date().toISOString()

  await db
    .insert(schema.pages)
    .values({ slug, title: parsed.data.title, content: sanitizeHtml(parsed.data.content) })
    .onConflictDoUpdate({
      target: schema.pages.slug,
      set: { title: parsed.data.title, content: sanitizeHtml(parsed.data.content), updatedAt: now },
    })

  await bumpDataVersion(db)

  return c.json({ ok: true, slug })
})

export default app
