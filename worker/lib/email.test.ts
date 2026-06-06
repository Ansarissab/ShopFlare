import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendEmail, sendOrderEmails, sendRestockEmail } from 'worker/lib/email'
import * as schema from 'worker/db/schema'
import { en } from '@/lib/i18n/en'
import type { Bindings } from 'worker/types'
import type { Database } from 'worker/db/index'

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

function okFetch(status = 200, body = '{}') {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(body, { status }))
}

function makeEnv(over: Partial<Bindings> = {}): Bindings {
  return {
    RESEND_API_KEY: 'key_123',
    RESEND_FROM: 'shop@verified.test',
    FRONTEND_URL: 'https://shop.test',
    ...over,
  } as unknown as Bindings
}

// ─── sendEmail ────────────────────────────────────────────────────────────────

describe('sendEmail', () => {
  it('returns false (no-op) when RESEND_API_KEY is unset', async () => {
    const f = okFetch()
    const ok = await sendEmail(makeEnv({ RESEND_API_KEY: undefined } as Partial<Bindings>), {
      to: 'a@b.c',
      subject: 's',
      html: '<p>x</p>',
    })
    expect(ok).toBe(false)
    expect(f).not.toHaveBeenCalled()
  })

  it('returns false when "to" is empty', async () => {
    const f = okFetch()
    expect(await sendEmail(makeEnv(), { to: '', subject: 's', html: 'h' })).toBe(false)
    expect(f).not.toHaveBeenCalled()
  })

  it('posts to Resend and returns true on 2xx', async () => {
    const f = okFetch(200)
    const ok = await sendEmail(makeEnv(), {
      to: 'cust@b.c',
      subject: 'Hi',
      html: '<p>x</p>',
      bcc: 'merchant@b.c',
      replyTo: 'merchant@b.c',
      from: 'sender@verified.test',
    })
    expect(ok).toBe(true)
    const [url, init] = f.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.resend.com/emails')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer key_123')
    const payload = JSON.parse(init.body as string)
    expect(payload.from).toBe('sender@verified.test')
    expect(payload.to).toEqual(['cust@b.c'])
    expect(payload.bcc).toEqual(['merchant@b.c'])
    expect(payload.reply_to).toBe('merchant@b.c')
  })

  it('falls back from→RESEND_FROM when opts.from absent, omits bcc/reply_to', async () => {
    const f = okFetch(200)
    await sendEmail(makeEnv(), { to: 'c@b.c', subject: 's', html: 'h' })
    const payload = JSON.parse((f.mock.calls[0][1] as RequestInit).body as string)
    expect(payload.from).toBe('shop@verified.test')
    expect(payload.bcc).toBeUndefined()
    expect(payload.reply_to).toBeUndefined()
  })

  it('falls back to onboarding@resend.dev when no from and no RESEND_FROM', async () => {
    const f = okFetch(200)
    await sendEmail(makeEnv({ RESEND_FROM: undefined } as Partial<Bindings>), {
      to: 'c@b.c',
      subject: 's',
      html: 'h',
    })
    const payload = JSON.parse((f.mock.calls[0][1] as RequestInit).body as string)
    expect(payload.from).toBe('onboarding@resend.dev')
  })

  it('returns false and warns on a non-2xx Resend response', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    okFetch(422, 'invalid')
    expect(await sendEmail(makeEnv(), { to: 'c@b.c', subject: 's', html: 'h' })).toBe(false)
    expect(warn).toHaveBeenCalled()
  })

  it('returns false on a thrown fetch error', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network'))
    expect(await sendEmail(makeEnv(), { to: 'c@b.c', subject: 's', html: 'h' })).toBe(false)
  })

  it('handles a non-2xx response whose text() rejects', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const res = { ok: false, status: 500, text: () => Promise.reject(new Error('no body')) }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(res as unknown as Response)
    expect(await sendEmail(makeEnv(), { to: 'c@b.c', subject: 's', html: 'h' })).toBe(false)
  })
})

// ─── sendOrderEmails ──────────────────────────────────────────────────────────

interface OrderRow {
  id: string
  orderNumber: string
  customerEmail: string | null
  paymentMethod: string
  subtotalCents: number
  shippingCents: number
  discountCents: number
  totalCents: number
}

interface ItemRow {
  quantity: number
  priceCents: number
  snapshot: string
}

/**
 * Builds a fake Drizzle db. `.get()` resolves the order; `.all()` resolves
 * the order items the first time and the store-config rows the second time,
 * keyed off which table was passed to `.from()`.
 */
function makeOrderDb(opts: {
  order: OrderRow | undefined
  items: ItemRow[]
  config: Record<string, string>
}): Database {
  const configRows = Object.entries(opts.config).map(([key, value]) => ({ key, value }))

  const from = vi.fn((table: unknown) => {
    const isItems = table === schema.orderItems
    const isConfig = table === schema.storeConfig
    const where = vi.fn(() => ({
      get: vi.fn().mockResolvedValue(opts.order),
      all: vi.fn().mockResolvedValue(isItems ? opts.items : isConfig ? configRows : []),
    }))
    return { where }
  })
  return { select: vi.fn(() => ({ from })) } as unknown as Database
}

function baseOrder(over: Partial<OrderRow> = {}): OrderRow {
  return {
    id: 'ord_1',
    orderNumber: 'SF-1001',
    customerEmail: 'buyer@b.c',
    paymentMethod: 'cod',
    subtotalCents: 5000,
    shippingCents: 0,
    discountCents: 0,
    totalCents: 5000,
    ...over,
  }
}

describe('sendOrderEmails', () => {
  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('no-ops when RESEND_API_KEY is unset', async () => {
    const f = okFetch()
    const db = makeOrderDb({ order: baseOrder(), items: [], config: {} })
    await sendOrderEmails(db, makeEnv({ RESEND_API_KEY: undefined } as Partial<Bindings>), 'ord_1')
    expect(f).not.toHaveBeenCalled()
  })

  it('no-ops when the order is not found', async () => {
    const f = okFetch()
    const db = makeOrderDb({ order: undefined, items: [], config: {} })
    await sendOrderEmails(db, makeEnv(), 'missing')
    expect(f).not.toHaveBeenCalled()
  })

  it('no-ops when the order has no customer email', async () => {
    const f = okFetch()
    const db = makeOrderDb({ order: baseOrder({ customerEmail: null }), items: [], config: {} })
    await sendOrderEmails(db, makeEnv(), 'ord_1')
    expect(f).not.toHaveBeenCalled()
  })

  it('sends a confirmation, with subject, BCC and tracking URL', async () => {
    const f = okFetch(200)
    const db = makeOrderDb({
      order: baseOrder({ subtotalCents: 6000, shippingCents: 500, discountCents: 1000, totalCents: 5500 }),
      items: [{ quantity: 2, priceCents: 3000, snapshot: JSON.stringify({ productName: 'Tee', variantLabel: 'Red', size: 'M' }) }],
      config: { currency: 'USD', contactEmail: 'merchant@b.c', senderEmail: 'noreply@verified.test' },
    })
    await sendOrderEmails(db, makeEnv(), 'ord_1')

    expect(f).toHaveBeenCalledTimes(1)
    const payload = JSON.parse((f.mock.calls[0][1] as RequestInit).body as string)
    expect(payload.subject).toBe(en.email.orderConfirmSubject.replace('{orderNumber}', 'SF-1001'))
    expect(payload.from).toBe('noreply@verified.test')
    expect(payload.bcc).toEqual(['merchant@b.c'])
    expect(payload.reply_to).toBe('merchant@b.c')
    expect(payload.html).toContain('https://shop.test/track/SF-1001')
    // item line + discount label rendered
    expect(payload.html).toContain('Tee — Red — M')
    expect(payload.html).toContain(en.email.labelDiscount)
    // free shipping label when shipping > 0? here shipping=500 so formatted, not "Free"
    expect(payload.html).toContain('$55.00')
  })

  it('renders the bank-transfer block for bank_transfer orders with an account number', async () => {
    const f = okFetch(200)
    const db = makeOrderDb({
      order: baseOrder({ paymentMethod: 'bank_transfer' }),
      items: [{ quantity: 1, priceCents: 5000, snapshot: 'not-json' }],
      config: { currency: 'PKR', bankAccountNumber: '0001234567', bankName: 'Test Bank', bankInstructions: 'Pay fast' },
    })
    await sendOrderEmails(db, makeEnv(), 'ord_1')
    const payload = JSON.parse((f.mock.calls[0][1] as RequestInit).body as string)
    expect(payload.html).toContain(en.bankTransfer.heading)
    expect(payload.html).toContain('0001234567')
    expect(payload.html).toContain('Pay fast')
    // bad snapshot JSON falls back to default 'Item' name + free shipping label
    expect(payload.html).toContain('Item')
    expect(payload.html).toContain('Free')
  })

  it('omits bank block for bank_transfer when no account number configured', async () => {
    const f = okFetch(200)
    const db = makeOrderDb({
      order: baseOrder({ paymentMethod: 'bank_transfer' }),
      items: [{ quantity: 1, priceCents: 100, snapshot: JSON.stringify({ productName: 'X' }) }],
      config: { currency: 'USD' },
    })
    await sendOrderEmails(db, makeEnv(), 'ord_1')
    const payload = JSON.parse((f.mock.calls[0][1] as RequestInit).body as string)
    expect(payload.html).not.toContain(en.bankTransfer.heading)
  })

  it('falls back to DEFAULT_CURRENCY when config currency is unknown, no bcc when contactEmail unset', async () => {
    const f = okFetch(200)
    const db = makeOrderDb({
      order: baseOrder(),
      items: [{ quantity: 1, priceCents: 5000, snapshot: JSON.stringify({ productName: 'Y' }) }],
      config: { currency: 'XYZ' },
    })
    await sendOrderEmails(db, makeEnv(), 'ord_1')
    const payload = JSON.parse((f.mock.calls[0][1] as RequestInit).body as string)
    // PKR symbol (default) used
    expect(payload.html).toContain('₨')
    expect(payload.bcc).toBeUndefined()
  })

  it('uses empty FRONTEND_URL gracefully in the track URL', async () => {
    const f = okFetch(200)
    const db = makeOrderDb({
      order: baseOrder(),
      items: [{ quantity: 1, priceCents: 5000, snapshot: JSON.stringify({ productName: 'Z' }) }],
      config: { currency: 'USD' },
    })
    await sendOrderEmails(db, makeEnv({ FRONTEND_URL: undefined } as Partial<Bindings>), 'ord_1')
    const payload = JSON.parse((f.mock.calls[0][1] as RequestInit).body as string)
    expect(payload.html).toContain('/track/SF-1001')
  })

  it('never throws when the db access fails', async () => {
    const db = { select: vi.fn(() => { throw new Error('db down') }) } as unknown as Database
    await expect(sendOrderEmails(db, makeEnv(), 'ord_1')).resolves.toBeUndefined()
  })
})

// ─── sendRestockEmail ─────────────────────────────────────────────────────────

describe('sendRestockEmail', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('returns false when RESEND_API_KEY is unset', async () => {
    const f = okFetch()
    const ok = await sendRestockEmail(makeEnv({ RESEND_API_KEY: undefined } as Partial<Bindings>), 'a@b.c', 'Tee', 'M', 'https://shop.test/p/1')
    expect(ok).toBe(false)
    expect(f).not.toHaveBeenCalled()
  })

  it('returns false when "to" is empty', async () => {
    const f = okFetch()
    expect(await sendRestockEmail(makeEnv(), '', 'Tee', 'M', 'url')).toBe(false)
    expect(f).not.toHaveBeenCalled()
  })

  it('sends a restock email with escaped product details and CTA', async () => {
    const f = okFetch(200)
    const ok = await sendRestockEmail(makeEnv(), 'a@b.c', 'Tee & <Co>', 'M', 'https://shop.test/p/1')
    expect(ok).toBe(true)
    const payload = JSON.parse((f.mock.calls[0][1] as RequestInit).body as string)
    expect(payload.subject).toBe(en.email.restockSubject.replace('{productName}', 'Tee & <Co>'))
    expect(payload.html).toContain('Tee &amp; &lt;Co&gt;')
    expect(payload.html).toContain('https://shop.test/p/1')
    expect(payload.html).toContain(en.email.restockCta)
  })

  it('returns false when the underlying send throws within the try', async () => {
    // Force an error inside the try by making en lookups throw is hard; instead
    // make fetch reject so sendEmail returns false (propagated).
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('boom'))
    expect(await sendRestockEmail(makeEnv(), 'a@b.c', 'Tee', 'M', 'url')).toBe(false)
  })
})
