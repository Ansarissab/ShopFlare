// Resend transactional email helper (Agent O).
//
// DRY: all email COPY lives in `en.email` (src/lib/i18n/en.ts). HTML is
// composed from those strings — never hardcode user-facing email text.
// Money is formatted with the local formatCents helper (mirrors the client
// formatPrice) — the worker deliberately does NOT import @/lib/utils/index,
// which would drag clsx/tailwind-merge/zustand and the client type graph into
// the worker bundle. Currency is read from store_config key "currency".
//
// Strategy (ADR-0005): ONE send to the customer, merchant BCC'd.
// BCC source: store_config.contactEmail → fallback env.RESEND_FROM (not a
// Bindings key, so no fallback needed — contactEmail is the only source).

import { eq, inArray } from 'drizzle-orm'
import type { Bindings } from 'worker/types'
import type { Database } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import { en } from '@/lib/i18n/en'
import { DEFAULT_CURRENCY, CURRENCIES } from '@/lib/constants'
import type { CurrencyCode } from '@/lib/constants'
import { formatCents } from './money'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  /** Verified sender. Falls back to RESEND_FROM env, then onboarding@resend.dev. */
  from?: string
  /** Merchant BCC (order copies) — see ADR 0005 Resend BCC strategy. */
  bcc?: string
  replyTo?: string
}

/** Minimal HTML-entity escape for user/admin-supplied values embedded in email HTML. */
function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ─── Config helpers ───────────────────────────────────────────────────────────

async function getStoreConfigValues(
  db: Database,
  keys: string[],
): Promise<Record<string, string>> {
  const rows = await db
    .select()
    .from(schema.storeConfig)
    .where(inArray(schema.storeConfig.key, keys))
    .all()

  const kv: Record<string, string> = {}
  for (const row of rows) kv[row.key] = row.value
  return kv
}

// ─── HTML helpers ─────────────────────────────────────────────────────────────

function tableRow(cells: string[], header = false): string {
  const tag = header ? 'th' : 'td'
  const style = header
    ? 'style="background:#f5f5f5;padding:8px 12px;text-align:left;font-size:13px;border-bottom:2px solid #ddd;"'
    : 'style="padding:8px 12px;font-size:13px;border-bottom:1px solid #eee;vertical-align:top;"'
  return `<tr>${cells.map((c) => `<${tag} ${style}>${c}</${tag}>`).join('')}</tr>`
}

function buildOrderEmailHtml(opts: {
  heading: string
  body: string
  orderNumber: string
  items: Array<{ name: string; qty: number; priceCents: number }>
  subtotalCents: number
  shippingCents: number
  discountCents: number
  totalCents: number
  currency: CurrencyCode
  trackUrl: string
}): string {
  const { heading, body, orderNumber, items, subtotalCents, shippingCents, discountCents, totalCents, currency, trackUrl } = opts
  const fmt = (c: number) => formatCents(c, currency)

  const itemRows = items
    .map((i) =>
      tableRow([
        i.name,
        String(i.qty),
        fmt(i.priceCents),
        fmt(i.priceCents * i.qty),
      ]),
    )
    .join('')

  const discountRow =
    discountCents > 0
      ? tableRow([`<strong>${en.email.labelDiscount}</strong>`, '', '', `-${fmt(discountCents)}`])
      : ''

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${heading}</title></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f9f9f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.07);max-width:600px;width:100%;">
        <tr><td style="background:#111;padding:24px 32px;">
          <h1 style="margin:0;color:#fff;font-size:20px;">${heading}</h1>
        </td></tr>
        <tr><td style="padding:24px 32px;">
          <p style="margin:0 0 16px;color:#444;font-size:15px;">${body.replace('{orderNumber}', `<strong>${orderNumber}</strong>`)}</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:16px;">
            ${tableRow([en.email.labelItem, en.email.labelQty, en.email.labelPrice, en.email.labelSubtotal], true)}
            ${itemRows}
            ${tableRow([`<strong>${en.email.labelSubtotal}</strong>`, '', '', fmt(subtotalCents)])}
            ${discountRow}
            ${tableRow([`<strong>${en.email.labelShipping}</strong>`, '', '', shippingCents === 0 ? 'Free' : fmt(shippingCents)])}
            ${tableRow([`<strong>${en.email.labelTotal}</strong>`, '', '', `<strong>${fmt(totalCents)}</strong>`])}
          </table>
          <p style="text-align:center;margin:24px 0 0;">
            <a href="${trackUrl}"
               style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:bold;">
              ${en.email.orderConfirmTrackCta}
            </a>
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px 24px;border-top:1px solid #eee;">
          <p style="margin:0;color:#888;font-size:12px;">${en.email.orderConfirmFooter}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ─── sendEmail ────────────────────────────────────────────────────────────────

/** Low-level send. Returns true on 2xx from Resend. No-op + false if RESEND_API_KEY unset. */
export async function sendEmail(env: Bindings, opts: SendEmailOptions): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false
  if (!opts.to) return false

  // Resend requires a verified "from" address. Resolution order:
  //   opts.from (store_config.senderEmail) → RESEND_FROM env → onboarding@resend.dev
  // The final fallback is Resend's shared test sender — fine for local/dev only;
  // production must set a verified domain sender (senderEmail or RESEND_FROM).
  const fromAddress = opts.from || env.RESEND_FROM || 'onboarding@resend.dev'

  const payload: Record<string, unknown> = {
    from: fromAddress,
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
  }

  if (opts.bcc) payload.bcc = [opts.bcc]
  if (opts.replyTo) payload.reply_to = opts.replyTo

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.warn('[email] Resend send failed', res.status, text)
      return false
    }

    return true
  } catch (err) {
    console.warn('[email] Resend fetch error', err)
    return false
  }
}

// ─── sendOrderEmails ──────────────────────────────────────────────────────────

/**
 * Sends the order-confirmation email to the customer and BCCs the merchant
 * (single send, BCC strategy — ADR 0005). Reads the order + items from D1 and
 * composes HTML from `en.email`. Called by the Stripe webhook (on confirm) and
 * the COD route (on create). Safe to await-and-ignore failures — never throws.
 *
 * BCC source: store_config.contactEmail. If unset, no BCC is sent (the
 * customer still gets their confirmation).
 */
export async function sendOrderEmails(db: Database, env: Bindings, orderId: string): Promise<void> {
  try {
    if (!env.RESEND_API_KEY) return

    // Load order row
    const order = await db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .get()

    if (!order || !order.customerEmail) return

    // Load order items
    const items = await db
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, orderId))
      .all()

    // Load store config: currency + contactEmail (BCC + reply-to) + senderEmail (from)
    const cfg = await getStoreConfigValues(db, ['currency', 'contactEmail', 'senderEmail'])

    const currency = (cfg['currency'] as CurrencyCode | undefined) ?? DEFAULT_CURRENCY
    // Validate the currency code is known; fall back to default if not.
    const validCurrency: CurrencyCode = currency in CURRENCIES ? currency : DEFAULT_CURRENCY

    const bcc = cfg['contactEmail'] || undefined
    const from = cfg['senderEmail'] || undefined

    const trackUrl = `${env.FRONTEND_URL || ''}/track/${order.orderNumber}`

    // Parse item snapshots
    const emailItems = items.map((item) => {
      let snap: { productName?: string; variantLabel?: string; size?: string } = {}
      try {
        snap = JSON.parse(item.snapshot)
      } catch {
        snap = {}
      }
      const parts = [snap.productName, snap.variantLabel, snap.size].filter(Boolean)
      return {
        // escape — product fields are admin-controlled but still untrusted in HTML
        name: escHtml(parts.join(' — ') || 'Item'),
        qty: item.quantity,
        priceCents: item.priceCents,
      }
    })

    const subject = en.email.orderConfirmSubject.replace('{orderNumber}', order.orderNumber)

    const html = buildOrderEmailHtml({
      heading: en.email.orderConfirmHeading,
      body: en.email.orderConfirmBody,
      orderNumber: order.orderNumber,
      items: emailItems,
      subtotalCents: order.subtotalCents,
      shippingCents: order.shippingCents,
      discountCents: order.discountCents,
      totalCents: order.totalCents,
      currency: validCurrency,
      trackUrl,
    })

    await sendEmail(env, {
      to: order.customerEmail,
      subject,
      html,
      from,
      bcc,
      // Customer replies reach the merchant, not the noreply sender.
      replyTo: bcc,
    })

    console.info('[email] order confirmation sent', { orderId, orderNumber: order.orderNumber })
  } catch (err) {
    // Never throw — this is fire-and-forget
    console.warn('[email] sendOrderEmails error', err)
  }
}

// ─── sendRestockEmail ─────────────────────────────────────────────────────────

/** Restock alert to one subscriber. Used by worker/lib/notify.ts (Agent Q). */
export async function sendRestockEmail(
  env: Bindings,
  to: string,
  productName: string,
  size: string,
  productUrl: string,
): Promise<boolean> {
  if (!env.RESEND_API_KEY || !to) return false

  try {
    // Raw subject for the email header; escaped copies for HTML embedding.
    const subject = en.email.restockSubject.replace('{productName}', productName)
    const safeName = escHtml(productName)
    const safeSize = escHtml(size)
    const body = en.email.restockBody
      .replace('{productName}', safeName)
      .replace('{size}', safeSize)

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${escHtml(subject)}</title></head>
<body style="font-family:Arial,Helvetica,sans-serif;background:#f9f9f9;margin:0;padding:32px 0;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,.07);overflow:hidden;max-width:560px;width:100%;">
        <tr><td style="background:#111;padding:24px 32px;">
          <h1 style="margin:0;color:#fff;font-size:20px;">${en.email.restockHeading}</h1>
        </td></tr>
        <tr><td style="padding:24px 32px;">
          <p style="color:#444;font-size:15px;margin:0 0 20px;">${body}</p>
          <p style="text-align:center;margin:0;">
            <a href="${productUrl}"
               style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-size:14px;font-weight:bold;">
              ${en.email.restockCta}
            </a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

    return sendEmail(env, { to, subject, html })
  } catch (err) {
    console.warn('[email] sendRestockEmail error', err)
    return false
  }
}
