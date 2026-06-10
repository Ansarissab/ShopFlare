import { describe, it, expect } from 'vitest'
import { updateConfigSchema } from './admin'
import {
  MIN_PRODUCT_PAGE_SIZE,
  MAX_PRODUCT_PAGE_SIZE,
  DEFAULT_PRODUCT_PAGE_SIZE,
} from '@/lib/constants'

// Phase 15 — the admin page-size setting is persisted through the shared config
// schema (PUT /api/admin/config → updateConfigSchema). These guard its bounds so
// the storefront never receives an out-of-range pagination size.

describe('updateConfigSchema · productPageSize', () => {
  it('accepts the default value', () => {
    const r = updateConfigSchema.safeParse({ productPageSize: DEFAULT_PRODUCT_PAGE_SIZE })
    expect(r.success).toBe(true)
  })

  it('accepts the min and max bounds', () => {
    expect(updateConfigSchema.safeParse({ productPageSize: MIN_PRODUCT_PAGE_SIZE }).success).toBe(
      true,
    )
    expect(updateConfigSchema.safeParse({ productPageSize: MAX_PRODUCT_PAGE_SIZE }).success).toBe(
      true,
    )
  })

  it('rejects values below the minimum', () => {
    expect(
      updateConfigSchema.safeParse({ productPageSize: MIN_PRODUCT_PAGE_SIZE - 1 }).success,
    ).toBe(false)
  })

  it('rejects values above the maximum', () => {
    expect(
      updateConfigSchema.safeParse({ productPageSize: MAX_PRODUCT_PAGE_SIZE + 1 }).success,
    ).toBe(false)
  })

  it('rejects non-integer values', () => {
    expect(updateConfigSchema.safeParse({ productPageSize: 24.5 }).success).toBe(false)
  })

  it('is optional — omitting it still validates', () => {
    expect(updateConfigSchema.safeParse({ storeName: 'Acme' }).success).toBe(true)
  })
})
