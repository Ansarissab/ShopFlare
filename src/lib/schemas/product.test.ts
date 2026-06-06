import { describe, it, expect } from 'vitest'
import {
  reviewSchema,
  submitReviewSchema,
  moderateReviewSchema,
  notifyMeSchema,
} from '@/lib/schemas/product'

describe('reviewSchema', () => {
  it('accepts valid review', () => {
    const r = reviewSchema.safeParse({
      productId: 'prod1',
      orderId: 'ord1',
      customerName: 'Alice',
      rating: 5,
    })
    expect(r.success).toBe(true)
  })

  it('accepts optional body', () => {
    const r = reviewSchema.safeParse({
      productId: 'prod1',
      orderId: 'ord1',
      customerName: 'Alice',
      rating: 3,
      body: 'Great product!',
    })
    expect(r.success).toBe(true)
  })

  it('rejects rating < 1', () => {
    const r = reviewSchema.safeParse({
      productId: 'prod1',
      orderId: 'ord1',
      customerName: 'Alice',
      rating: 0,
    })
    expect(r.success).toBe(false)
  })

  it('rejects rating > 5', () => {
    const r = reviewSchema.safeParse({
      productId: 'prod1',
      orderId: 'ord1',
      customerName: 'Alice',
      rating: 6,
    })
    expect(r.success).toBe(false)
  })

  it('rejects float rating', () => {
    const r = reviewSchema.safeParse({
      productId: 'prod1',
      orderId: 'ord1',
      customerName: 'Alice',
      rating: 4.5,
    })
    expect(r.success).toBe(false)
  })

  it('rejects body exceeding 1000 chars', () => {
    const r = reviewSchema.safeParse({
      productId: 'prod1',
      orderId: 'ord1',
      customerName: 'Alice',
      rating: 4,
      body: 'x'.repeat(1001),
    })
    expect(r.success).toBe(false)
  })

  it('rejects empty customerName', () => {
    const r = reviewSchema.safeParse({
      productId: 'prod1',
      orderId: 'ord1',
      customerName: '',
      rating: 4,
    })
    expect(r.success).toBe(false)
  })

  it('rejects customerName over 120 chars', () => {
    const r = reviewSchema.safeParse({
      productId: 'prod1',
      orderId: 'ord1',
      customerName: 'A'.repeat(121),
      rating: 4,
    })
    expect(r.success).toBe(false)
  })
})

describe('submitReviewSchema', () => {
  it('accepts valid public review submission', () => {
    const r = submitReviewSchema.safeParse({
      productId: 'prod1',
      customerName: 'Bob',
      rating: 4,
      orderNumber: 'ORD-123',
      contact: 'bob@example.com',
    })
    expect(r.success).toBe(true)
  })

  it('rejects contact shorter than 4 chars', () => {
    const r = submitReviewSchema.safeParse({
      productId: 'prod1',
      customerName: 'Bob',
      rating: 4,
      orderNumber: 'ORD-123',
      contact: 'bo',
    })
    expect(r.success).toBe(false)
  })

  it('rejects missing orderNumber', () => {
    const r = submitReviewSchema.safeParse({
      productId: 'prod1',
      customerName: 'Bob',
      rating: 4,
      contact: 'bob@example.com',
    })
    expect(r.success).toBe(false)
  })
})

describe('moderateReviewSchema', () => {
  it('accepts approved: true', () => {
    expect(moderateReviewSchema.safeParse({ approved: true }).success).toBe(true)
  })

  it('accepts approved: false', () => {
    expect(moderateReviewSchema.safeParse({ approved: false }).success).toBe(true)
  })

  it('rejects non-boolean approved', () => {
    expect(moderateReviewSchema.safeParse({ approved: 'yes' }).success).toBe(false)
  })
})

describe('notifyMeSchema', () => {
  it('accepts email-only', () => {
    const r = notifyMeSchema.safeParse({
      sizeOptionId: 'sz1',
      email: 'user@example.com',
    })
    expect(r.success).toBe(true)
  })

  it('accepts phone-only', () => {
    const r = notifyMeSchema.safeParse({
      sizeOptionId: 'sz1',
      phone: '+12025551234',
    })
    expect(r.success).toBe(true)
  })

  it('accepts both email and phone', () => {
    const r = notifyMeSchema.safeParse({
      sizeOptionId: 'sz1',
      email: 'user@example.com',
      phone: '+12025551234',
    })
    expect(r.success).toBe(true)
  })

  it('rejects when neither email nor phone provided', () => {
    const r = notifyMeSchema.safeParse({ sizeOptionId: 'sz1' })
    expect(r.success).toBe(false)
  })

  it('rejects empty sizeOptionId', () => {
    const r = notifyMeSchema.safeParse({
      sizeOptionId: '',
      email: 'user@example.com',
    })
    expect(r.success).toBe(false)
  })

  it('rejects invalid email format', () => {
    const r = notifyMeSchema.safeParse({
      sizeOptionId: 'sz1',
      email: 'not-an-email',
    })
    expect(r.success).toBe(false)
  })
})
