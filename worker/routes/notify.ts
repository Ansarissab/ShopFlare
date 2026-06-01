import { Hono } from 'hono'
import { eq, and, or } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { createDb } from '../db/index'
import * as schema from '../db/schema'
import { notifyMeSchema } from '@/lib/schemas'
import { parseBody } from '../lib/http'
import { verifyTurnstile } from '../lib/turnstile'
import type { Bindings } from '../types'

const app = new Hono<{ Bindings: Bindings }>()

app.post('/', async (c) => {
  // Security: verify Turnstile token before any DB work
  const token = c.req.header('X-Turnstile-Token') ?? null
  const valid = await verifyTurnstile(token, c.env.TURNSTILE_SECRET_KEY, c.req.header('CF-Connecting-IP'))
  if (!valid) return c.json({ error: 'Security check failed' }, 403)

  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  // Validate
  const result = notifyMeSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: 'Validation failed', issues: result.error.issues }, 400)
  }

  const { sizeOptionId, email, phone } = result.data
  const db = createDb(c.env.DB)

  // Check sizeOption exists and is OOS
  // stock === 0  → truly OOS (allow subscribe)
  // stock === -1 → unlimited (item IS available — reject)
  // stock  > 0  → in stock (reject)
  const sizeOption = await db
    .select({ id: schema.sizeOptions.id, stock: schema.sizeOptions.stock })
    .from(schema.sizeOptions)
    .where(eq(schema.sizeOptions.id, sizeOptionId))
    .get()

  if (!sizeOption) {
    return c.json({ error: 'Size option not found' }, 404)
  }

  if (sizeOption.stock !== 0) {
    return c.json({ error: 'Item is in stock' }, 400)
  }

  // Check for duplicate — same sizeOptionId + (same email OR same phone)
  try {
    if (email && phone) {
      const existing = await db
        .select({ id: schema.notifyMe.id })
        .from(schema.notifyMe)
        .where(
          and(
            eq(schema.notifyMe.sizeOptionId, sizeOptionId),
            or(
              eq(schema.notifyMe.email, email),
              eq(schema.notifyMe.phone, phone),
            ),
          ),
        )
        .get()
      if (existing) return c.json({ ok: true, duplicate: true })
    } else if (email) {
      const existing = await db
        .select({ id: schema.notifyMe.id })
        .from(schema.notifyMe)
        .where(
          and(
            eq(schema.notifyMe.sizeOptionId, sizeOptionId),
            eq(schema.notifyMe.email, email),
          ),
        )
        .get()
      if (existing) return c.json({ ok: true, duplicate: true })
    } else if (phone) {
      const existing = await db
        .select({ id: schema.notifyMe.id })
        .from(schema.notifyMe)
        .where(
          and(
            eq(schema.notifyMe.sizeOptionId, sizeOptionId),
            eq(schema.notifyMe.phone, phone),
          ),
        )
        .get()
      if (existing) return c.json({ ok: true, duplicate: true })
    }

    // Insert
    await db.insert(schema.notifyMe).values({
      id: nanoid(),
      sizeOptionId,
      email: email ?? null,
      phone: phone ?? null,
      notified: false,
    })

    return c.json({ ok: true })
  } catch (err) {
    console.error('notify insert error', err)
    return c.json({ error: 'Database error' }, 500)
  }
})

export default app
