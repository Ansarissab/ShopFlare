// Push subscription management — mounted at /api/admin/push, behind CF Access
// (requireAccess on the admin router). These are MERCHANT-only: order-alert
// subscriptions for the merchant's own devices, so they must not live on the
// public /api router.
//
// POST /subscribe  — save or update a PushSubscription (endpoint/auth/p256dh).
//                   Idempotent: uses onConflictDoUpdate to handle re-subscription
//                   with the same endpoint (auth/p256dh may rotate on browser reset).
//
// POST /unsubscribe — delete a subscription by endpoint.
//
// POST /send       — admin trigger: sends a tickle to all stored subscriptions.
//                   Gated by CF Access via the parent admin router.

import { Hono } from 'hono'
import { nanoid } from 'nanoid'
import { eq } from 'drizzle-orm'
import { createDb } from '../db/index'
import * as schema from '../db/schema'
import { parseBody } from '../lib/http'
import { sendPushToAll, type PushPayload } from '../lib/push'
import type { AdminEnv } from '../lib/access'
import { en } from '@/lib/i18n/en'

const app = new Hono<AdminEnv>()

// ─── POST /subscribe ──────────────────────────────────────────────────────────

app.post('/subscribe', async (c) => {
  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  if (
    !body ||
    typeof body !== 'object' ||
    typeof (body as Record<string, unknown>).endpoint !== 'string' ||
    typeof (body as Record<string, unknown>).auth !== 'string' ||
    typeof (body as Record<string, unknown>).p256dh !== 'string'
  ) {
    return c.json({ error: 'endpoint, auth, and p256dh are required' }, 400)
  }

  const { endpoint, auth, p256dh } = body as { endpoint: string; auth: string; p256dh: string }

  const db = createDb(c.env.DB)

  await db
    .insert(schema.pushSubscriptions)
    .values({ id: nanoid(), endpoint, auth, p256dh })
    .onConflictDoUpdate({
      target: schema.pushSubscriptions.endpoint,
      set: { auth, p256dh },
    })

  return c.json({ ok: true }, 201)
})

// ─── POST /unsubscribe ────────────────────────────────────────────────────────

app.post('/unsubscribe', async (c) => {
  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  if (
    !body ||
    typeof body !== 'object' ||
    typeof (body as Record<string, unknown>).endpoint !== 'string'
  ) {
    return c.json({ error: 'endpoint is required' }, 400)
  }

  const { endpoint } = body as { endpoint: string }
  const db = createDb(c.env.DB)

  await db
    .delete(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.endpoint, endpoint))

  return c.json({ ok: true })
})

// ─── POST /send ───────────────────────────────────────────────────────────────
// Admin test/trigger endpoint. Access control is intentionally loose for local
// dev; production callers go through CF Access-gated admin UI.

app.post('/send', async (c) => {
  const [body, errResp] = await parseBody(c)
  if (errResp) return errResp

  const b = (body ?? {}) as Partial<PushPayload>
  const payload: PushPayload = {
    title: typeof b.title === 'string' ? b.title : en.notifications.newOrderTitle,
    body: typeof b.body === 'string' ? b.body : '',
    url: typeof b.url === 'string' ? b.url : undefined,
  }

  const db = createDb(c.env.DB)
  const count = await sendPushToAll(db, c.env, payload)

  return c.json({ ok: true, sent: count })
})

export default app
