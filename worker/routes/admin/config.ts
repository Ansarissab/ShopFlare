// Admin config routes — mounted under /api/admin/config, behind requireAccess.
// The public, read-only GET /api/config/store lives in routes/config.ts.

import { Hono } from 'hono'
import { createDb } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import { updateConfigSchema } from '@/lib/schemas'
import { parseBody } from 'worker/lib/http'
import type { AdminEnv } from 'worker/lib/access'

const app = new Hono<AdminEnv>()

// ─── PUT /store — upsert store config ─────────────────────────────────────────

app.put('/store', async (c) => {
  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const parsed = updateConfigSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', issues: parsed.error.issues }, 400)
  }

  const db = createDb(c.env.DB)
  const now = new Date().toISOString()

  const updates = Object.entries(parsed.data).filter(([, v]) => v !== undefined)

  for (const [key, value] of updates) {
    await db
      .insert(schema.storeConfig)
      .values({ key, value: String(value), updatedAt: now })
      .onConflictDoUpdate({ target: schema.storeConfig.key, set: { value: String(value), updatedAt: now } })
  }

  return c.json({ ok: true, updated: updates.map(([k]) => k) })
})

export default app
