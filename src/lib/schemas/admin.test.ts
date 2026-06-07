import { describe, it, expect } from 'vitest'
import {
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
  updateVariantSchema,
  createSizeOptionSchema,
  updateOrderStatusSchema,
  updateTrackingSchema,
  posOrderSchema,
  createCouponSchema,
  updateCouponSchema,
  updatePageSchema,
  createCategorySchema,
  updateCategorySchema,
  setProductCategoriesSchema,
  reorderCategoryProductsSchema,
} from '@/lib/schemas/admin'

// ─── Product ──────────────────────────────────────────────────────────────────

describe('createProductSchema', () => {
  it('accepts minimal valid product', () => {
    const r = createProductSchema.safeParse({ name: 'T-Shirt' })
    expect(r.success).toBe(true)
  })

  it('defaults active to true and description to empty string', () => {
    const r = createProductSchema.safeParse({ name: 'T-Shirt' })
    if (!r.success) throw r.error
    expect(r.data.active).toBe(true)
    expect(r.data.description).toBe('')
  })

  it('rejects empty name', () => {
    expect(createProductSchema.safeParse({ name: '' }).success).toBe(false)
  })

  it('rejects name over 200 chars', () => {
    expect(createProductSchema.safeParse({ name: 'A'.repeat(201) }).success).toBe(false)
  })

  it('accepts optional stripeProductId', () => {
    const r = createProductSchema.safeParse({ name: 'Hat', stripeProductId: 'prod_123' })
    expect(r.success).toBe(true)
  })
})

describe('updateProductSchema', () => {
  it('accepts empty object (all partial)', () => {
    expect(updateProductSchema.safeParse({}).success).toBe(true)
  })

  it('accepts partial update', () => {
    expect(updateProductSchema.safeParse({ active: false }).success).toBe(true)
  })
})

// ─── Variant ─────────────────────────────────────────────────────────────────

describe('createVariantSchema', () => {
  it('accepts valid variant', () => {
    const r = createVariantSchema.safeParse({ productId: 'p1', label: 'Red' })
    expect(r.success).toBe(true)
  })

  it('defaults sortOrder to 0', () => {
    const r = createVariantSchema.safeParse({ productId: 'p1', label: 'Red' })
    if (!r.success) throw r.error
    expect(r.data.sortOrder).toBe(0)
  })

  it('accepts valid colorHex', () => {
    const r = createVariantSchema.safeParse({ productId: 'p1', label: 'Red', colorHex: '#ff0000' })
    expect(r.success).toBe(true)
  })

  it('rejects invalid colorHex', () => {
    const r = createVariantSchema.safeParse({ productId: 'p1', label: 'Red', colorHex: 'red' })
    expect(r.success).toBe(false)
  })

  it('rejects negative sortOrder', () => {
    const r = createVariantSchema.safeParse({ productId: 'p1', label: 'Red', sortOrder: -1 })
    expect(r.success).toBe(false)
  })

  it('rejects empty productId', () => {
    expect(createVariantSchema.safeParse({ productId: '', label: 'Red' }).success).toBe(false)
  })
})

describe('updateVariantSchema', () => {
  it('accepts empty object (all partial, productId omitted)', () => {
    expect(updateVariantSchema.safeParse({}).success).toBe(true)
  })
})

// ─── Size option ─────────────────────────────────────────────────────────────

describe('createSizeOptionSchema', () => {
  it('accepts valid size option', () => {
    const r = createSizeOptionSchema.safeParse({
      variantId: 'v1',
      size: 'M',
      priceCents: 2500,
    })
    expect(r.success).toBe(true)
  })

  it('defaults stock to 0 and active to true', () => {
    const r = createSizeOptionSchema.safeParse({ variantId: 'v1', size: 'M', priceCents: 0 })
    if (!r.success) throw r.error
    expect(r.data.stock).toBe(0)
    expect(r.data.active).toBe(true)
  })

  it('accepts priceCents of 0', () => {
    expect(createSizeOptionSchema.safeParse({ variantId: 'v1', size: 'M', priceCents: 0 }).success).toBe(true)
  })

  it('rejects negative priceCents', () => {
    expect(createSizeOptionSchema.safeParse({ variantId: 'v1', size: 'M', priceCents: -1 }).success).toBe(false)
  })

  it('accepts stock of -1 (unlimited)', () => {
    const r = createSizeOptionSchema.safeParse({ variantId: 'v1', size: 'M', priceCents: 100, stock: -1 })
    expect(r.success).toBe(true)
  })

  it('rejects stock below -1', () => {
    expect(createSizeOptionSchema.safeParse({ variantId: 'v1', size: 'M', priceCents: 100, stock: -2 }).success).toBe(false)
  })
})

// ─── Order admin ─────────────────────────────────────────────────────────────

describe('updateOrderStatusSchema', () => {
  it('accepts valid status', () => {
    const statuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']
    for (const status of statuses) {
      expect(updateOrderStatusSchema.safeParse({ status }).success).toBe(true)
    }
  })

  it('accepts optional notes', () => {
    const r = updateOrderStatusSchema.safeParse({ status: 'shipped', notes: 'Dispatched today' })
    expect(r.success).toBe(true)
  })

  it('rejects unknown status', () => {
    expect(updateOrderStatusSchema.safeParse({ status: 'refunded' }).success).toBe(false)
  })

  it('rejects notes over 500 chars', () => {
    expect(
      updateOrderStatusSchema.safeParse({ status: 'shipped', notes: 'x'.repeat(501) }).success,
    ).toBe(false)
  })
})

describe('updateTrackingSchema', () => {
  it('accepts valid tracking number', () => {
    const r = updateTrackingSchema.safeParse({ trackingNumber: 'TRK123456789' })
    expect(r.success).toBe(true)
  })

  it('accepts optional carrier', () => {
    const r = updateTrackingSchema.safeParse({ trackingNumber: 'TRK123', carrier: 'FedEx' })
    expect(r.success).toBe(true)
  })

  it('rejects empty trackingNumber', () => {
    expect(updateTrackingSchema.safeParse({ trackingNumber: '' }).success).toBe(false)
  })
})

describe('posOrderSchema', () => {
  it('accepts valid POS order', () => {
    const r = posOrderSchema.safeParse({
      items: [{ sizeOptionId: 'sz1', quantity: 2 }],
    })
    expect(r.success).toBe(true)
  })

  it('rejects empty items', () => {
    expect(posOrderSchema.safeParse({ items: [] }).success).toBe(false)
  })

  it('accepts optional customerPhone', () => {
    const r = posOrderSchema.safeParse({
      items: [{ sizeOptionId: 'sz1', quantity: 1 }],
      customerPhone: '+12025551234',
    })
    expect(r.success).toBe(true)
  })

  it('rejects quantity over 999', () => {
    const r = posOrderSchema.safeParse({
      items: [{ sizeOptionId: 'sz1', quantity: 1000 }],
    })
    expect(r.success).toBe(false)
  })
})

// ─── Coupon ──────────────────────────────────────────────────────────────────

describe('createCouponSchema', () => {
  const valid = {
    code: 'SUMMER10',
    type: 'percentage' as const,
    value: 10,
  }

  it('accepts valid percentage coupon', () => {
    expect(createCouponSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts valid fixed coupon', () => {
    const r = createCouponSchema.safeParse({ code: 'FLAT100', type: 'fixed', value: 100 })
    expect(r.success).toBe(true)
  })

  it('defaults perCustomerLimit to 1 and active to true', () => {
    const r = createCouponSchema.safeParse(valid)
    if (!r.success) throw r.error
    expect(r.data.perCustomerLimit).toBe(1)
    expect(r.data.active).toBe(true)
  })

  it('rejects percentage value over 100', () => {
    const r = createCouponSchema.safeParse({ ...valid, value: 101 })
    expect(r.success).toBe(false)
  })

  it('allows fixed value over 100', () => {
    const r = createCouponSchema.safeParse({ code: 'BIG500', type: 'fixed', value: 500 })
    expect(r.success).toBe(true)
  })

  it('rejects code shorter than 6 chars', () => {
    expect(createCouponSchema.safeParse({ ...valid, code: 'SAVE' }).success).toBe(false)
  })

  it('rejects code with special characters', () => {
    expect(createCouponSchema.safeParse({ ...valid, code: 'SAVE!!' }).success).toBe(false)
  })

  it('rejects code longer than 20 chars', () => {
    expect(createCouponSchema.safeParse({ ...valid, code: 'A'.repeat(21) }).success).toBe(false)
  })

  it('accepts nullish optional fields', () => {
    const r = createCouponSchema.safeParse({
      ...valid,
      minOrderCents: null,
      maxDiscountCents: null,
      usageLimit: null,
      expiresAt: null,
    })
    expect(r.success).toBe(true)
  })
})

describe('updateCouponSchema', () => {
  it('accepts empty object (all partial)', () => {
    expect(updateCouponSchema.safeParse({}).success).toBe(true)
  })

  it('accepts partial update', () => {
    expect(updateCouponSchema.safeParse({ active: false }).success).toBe(true)
  })
})

// ─── Page ─────────────────────────────────────────────────────────────────────

describe('updatePageSchema', () => {
  it('accepts valid page update', () => {
    const r = updatePageSchema.safeParse({ title: 'Privacy Policy', content: 'Our policy...' })
    expect(r.success).toBe(true)
  })

  it('defaults content to empty string', () => {
    const r = updatePageSchema.safeParse({ title: 'Terms' })
    if (!r.success) throw r.error
    expect(r.data.content).toBe('')
  })

  it('rejects empty title', () => {
    expect(updatePageSchema.safeParse({ title: '' }).success).toBe(false)
  })

  it('rejects title over 200 chars', () => {
    expect(updatePageSchema.safeParse({ title: 'T'.repeat(201) }).success).toBe(false)
  })
})

// ─── Category ────────────────────────────────────────────────────────────────

describe('createCategorySchema', () => {
  it('accepts valid category', () => {
    const r = createCategorySchema.safeParse({ name: 'T-Shirts' })
    expect(r.success).toBe(true)
  })

  it('accepts valid slug', () => {
    const r = createCategorySchema.safeParse({ name: 'T-Shirts', slug: 't-shirts' })
    expect(r.success).toBe(true)
  })

  it('rejects slug with uppercase', () => {
    const r = createCategorySchema.safeParse({ name: 'T-Shirts', slug: 'T-Shirts' })
    expect(r.success).toBe(false)
  })

  it('rejects slug with spaces', () => {
    const r = createCategorySchema.safeParse({ name: 'T-Shirts', slug: 't shirts' })
    expect(r.success).toBe(false)
  })

  it('defaults sortOrder to 0 and active to true', () => {
    const r = createCategorySchema.safeParse({ name: 'Hoodies' })
    if (!r.success) throw r.error
    expect(r.data.sortOrder).toBe(0)
    expect(r.data.active).toBe(true)
  })

  it('rejects empty name', () => {
    expect(createCategorySchema.safeParse({ name: '' }).success).toBe(false)
  })
})

describe('updateCategorySchema', () => {
  it('accepts empty object (all partial)', () => {
    expect(updateCategorySchema.safeParse({}).success).toBe(true)
  })
})

describe('setProductCategoriesSchema', () => {
  it('accepts array of category IDs', () => {
    const r = setProductCategoriesSchema.safeParse({ categoryIds: ['cat1', 'cat2'] })
    expect(r.success).toBe(true)
  })

  it('defaults categoryIds to empty array', () => {
    const r = setProductCategoriesSchema.safeParse({})
    if (!r.success) throw r.error
    expect(r.data.categoryIds).toEqual([])
  })

  it('rejects more than 10 categories', () => {
    const r = setProductCategoriesSchema.safeParse({
      categoryIds: Array.from({ length: 11 }, (_, i) => `cat${i}`),
    })
    expect(r.success).toBe(false)
  })
})

describe('reorderCategoryProductsSchema', () => {
  it('accepts array of product IDs', () => {
    const r = reorderCategoryProductsSchema.safeParse({ productIds: ['p1', 'p2', 'p3'] })
    expect(r.success).toBe(true)
  })

  it('accepts empty productIds array', () => {
    const r = reorderCategoryProductsSchema.safeParse({ productIds: [] })
    expect(r.success).toBe(true)
  })
})
