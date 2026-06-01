import { Hono } from 'hono'
import { z } from 'zod/v4'
import { drizzle } from 'drizzle-orm/d1'
import { eq, and, or } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import * as schema from '../db/schema'

type Bindings = {
  DB: D1Database
  KV: KVNamespace
  R2: R2Bucket
  STRIPE_SECRET_KEY: string
  STRIPE_WEBHOOK_SECRET: string
  RESEND_API_KEY: string
  VAPID_PRIVATE_KEY: string
  VAPID_PUBLIC_KEY: string
}

const app = new Hono<{ Bindings: Bindings }>()

const notifySchema = z.object({
  sizeOptionId: z.string(),
  email: z.string().email().optional(),
  phone: z.string().min(7).optional(),
}).refine(d => d.email || d.phone, { message: 'email or phone required' })

app.post('/', async (c) => {
  // Parse body
  let body: unknown
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  // Validate
  const result = notifySchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: 'Validation failed', issues: result.error.issues }, 400)
  }

  const { sizeOptionId, email, phone } = result.data
  const db = drizzle(c.env.DB, { schema })

  // Check sizeOption exists and is OOS
  const sizeOption = await db
    .select({ id: schema.sizeOptions.id, stock: schema.sizeOptions.stock })
    .from(schema.sizeOptions)
    .where(eq(schema.sizeOptions.id, sizeOptionId))
    .get()

  if (!sizeOption) {
    return c.json({ error: 'Size option not found' }, 404)
  }

  if (sizeOption.stock > 0) {
    return c.json({ error: 'Item is in stock' }, 400)
  }

  // Check for duplicate — same sizeOptionId + (same email OR same phone)
  try {
    const conditions = [eq(schema.notifyMe.sizeOptionId, sizeOptionId)]

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
        .where(and(...conditions, eq(schema.notifyMe.email, email)))
        .get()
      if (existing) return c.json({ ok: true, duplicate: true })
    } else if (phone) {
      const existing = await db
        .select({ id: schema.notifyMe.id })
        .from(schema.notifyMe)
        .where(and(...conditions, eq(schema.notifyMe.phone, phone)))
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
