import { describe, it, expect } from 'vitest'
import {
  pushSubscriptionSchema,
  pushUnsubscribeSchema,
  pushSendSchema,
  customerPushSubscriptionSchema,
  customerPushUnsubscribeSchema,
} from '@/lib/schemas/push'

const validSubscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
  auth: 'base64authkey==',
  p256dh: 'base64p256dhkey==',
}

describe('pushSubscriptionSchema', () => {
  it('accepts valid subscription', () => {
    const r = pushSubscriptionSchema.safeParse(validSubscription)
    expect(r.success).toBe(true)
  })

  it('rejects non-URL endpoint', () => {
    const r = pushSubscriptionSchema.safeParse({ ...validSubscription, endpoint: 'not-a-url' })
    expect(r.success).toBe(false)
  })

  it('rejects empty auth', () => {
    const r = pushSubscriptionSchema.safeParse({ ...validSubscription, auth: '' })
    expect(r.success).toBe(false)
  })

  it('rejects empty p256dh', () => {
    const r = pushSubscriptionSchema.safeParse({ ...validSubscription, p256dh: '' })
    expect(r.success).toBe(false)
  })

  it('rejects endpoint over 2048 chars', () => {
    const r = pushSubscriptionSchema.safeParse({
      ...validSubscription,
      endpoint: 'https://example.com/' + 'a'.repeat(2030),
    })
    expect(r.success).toBe(false)
  })

  it('rejects auth over 256 chars', () => {
    const r = pushSubscriptionSchema.safeParse({ ...validSubscription, auth: 'a'.repeat(257) })
    expect(r.success).toBe(false)
  })
})

describe('pushUnsubscribeSchema', () => {
  it('accepts endpoint only', () => {
    const r = pushUnsubscribeSchema.safeParse({
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
    })
    expect(r.success).toBe(true)
  })

  it('rejects non-URL endpoint', () => {
    const r = pushUnsubscribeSchema.safeParse({ endpoint: 'bad-endpoint' })
    expect(r.success).toBe(false)
  })

  it('does not include auth or p256dh fields', () => {
    const r = pushUnsubscribeSchema.safeParse({ endpoint: 'https://example.com/push' })
    if (!r.success) throw r.error
    expect('auth' in r.data).toBe(false)
    expect('p256dh' in r.data).toBe(false)
  })
})

describe('pushSendSchema', () => {
  it('accepts empty body (all optional)', () => {
    expect(pushSendSchema.safeParse({}).success).toBe(true)
  })

  it('accepts title + body + url', () => {
    const r = pushSendSchema.safeParse({
      title: 'New Order!',
      body: 'You have a new order.',
      url: '/admin/orders',
    })
    expect(r.success).toBe(true)
  })

  it('rejects absolute URL for url field', () => {
    const r = pushSendSchema.safeParse({ url: 'https://evil.com' })
    expect(r.success).toBe(false)
  })

  it('rejects url without leading slash', () => {
    const r = pushSendSchema.safeParse({ url: 'admin/orders' })
    expect(r.success).toBe(false)
  })

  it('accepts relative path with query', () => {
    const r = pushSendSchema.safeParse({ url: '/admin/orders?status=pending' })
    expect(r.success).toBe(true)
  })

  it('rejects title over 120 chars', () => {
    const r = pushSendSchema.safeParse({ title: 'T'.repeat(121) })
    expect(r.success).toBe(false)
  })

  it('rejects body over 500 chars', () => {
    const r = pushSendSchema.safeParse({ body: 'B'.repeat(501) })
    expect(r.success).toBe(false)
  })
})

describe('customerPushSubscriptionSchema', () => {
  it('accepts valid customer subscription', () => {
    const r = customerPushSubscriptionSchema.safeParse({
      ...validSubscription,
      orderNumber: 'ORD-20240001',
    })
    expect(r.success).toBe(true)
  })

  it('rejects missing orderNumber', () => {
    const r = customerPushSubscriptionSchema.safeParse(validSubscription)
    expect(r.success).toBe(false)
  })

  it('rejects empty orderNumber', () => {
    const r = customerPushSubscriptionSchema.safeParse({ ...validSubscription, orderNumber: '' })
    expect(r.success).toBe(false)
  })

  it('rejects orderNumber over 20 chars', () => {
    const r = customerPushSubscriptionSchema.safeParse({
      ...validSubscription,
      orderNumber: 'O'.repeat(21),
    })
    expect(r.success).toBe(false)
  })
})

describe('customerPushUnsubscribeSchema', () => {
  it('accepts endpoint only', () => {
    const r = customerPushUnsubscribeSchema.safeParse({
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
    })
    expect(r.success).toBe(true)
  })

  it('rejects invalid endpoint', () => {
    const r = customerPushUnsubscribeSchema.safeParse({ endpoint: 'not-a-url' })
    expect(r.success).toBe(false)
  })
})
