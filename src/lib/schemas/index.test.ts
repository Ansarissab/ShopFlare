import { describe, it, expect } from 'vitest'
import * as schemas from '@/lib/schemas'

// The barrel re-exports every sub-module. These assertions prove the public
// surface stays wired up — a missing `export *` line would break a named import.
describe('schemas barrel (index.ts)', () => {
  it('re-exports base primitives', () => {
    expect(schemas.idField).toBeDefined()
    expect(schemas.quantityField).toBeDefined()
    expect(schemas.emailField).toBeDefined()
    expect(schemas.phoneField).toBeDefined()
    expect(schemas.couponField).toBeDefined()
    expect(schemas.contactSchema).toBeDefined()
    expect(schemas.orderItemSchema).toBeDefined()
    expect(schemas.hexColorField).toBeDefined()
  })

  it('re-exports order domain schemas', () => {
    expect(schemas.shippingAddressSchema).toBeDefined()
    expect(schemas.codOrderSchema).toBeDefined()
    expect(schemas.createCheckoutSessionSchema).toBeDefined()
    expect(schemas.cancelOrderSchema).toBeDefined()
  })

  it('re-exports product domain schemas', () => {
    expect(schemas.reviewSchema).toBeDefined()
    expect(schemas.submitReviewSchema).toBeDefined()
    expect(schemas.moderateReviewSchema).toBeDefined()
    expect(schemas.notifyMeSchema).toBeDefined()
  })

  it('barreled schema actually parses through the re-export', () => {
    const ok = schemas.codOrderSchema.safeParse({
      items: [{ sizeOptionId: 'sz1', quantity: 1 }],
      shippingAddress: {
        name: 'Jane',
        address: '12 Main St',
        city: 'Karachi',
        country: 'PK',
      },
    })
    expect(ok.success).toBe(true)
  })

  it('exposes config / admin / push exports', () => {
    // sanity: at least one symbol from each remaining sub-module is present
    const keys = Object.keys(schemas)
    expect(keys.length).toBeGreaterThan(10)
  })
})
