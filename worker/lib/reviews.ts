// Shared review-flag guard — used by both the public reviews route and admin.
// reviewsAllowed: site-wide OFF wins. Reads the KV-backed store config flag
// (reviewsEnabled) AND the per-product column (products.reviews_enabled).
// Caller can short-circuit after this before doing any further DB work.

import { eq } from 'drizzle-orm'
import type { Database } from 'worker/db/index'
import * as schema from 'worker/db/schema'

export async function reviewsAllowed(db: Database, productId: string): Promise<boolean> {
  // Read site-wide flag from D1 KV store. Default true when unset.
  const siteRow = await db
    .select({ value: schema.storeConfig.value })
    .from(schema.storeConfig)
    .where(eq(schema.storeConfig.key, 'reviewsEnabled'))
    .get()

  const siteWide = siteRow !== undefined ? siteRow.value === 'true' : true

  if (!siteWide) return false

  // Read per-product flag.
  const productRow = await db
    .select({ reviewsEnabled: schema.products.reviewsEnabled })
    .from(schema.products)
    .where(eq(schema.products.id, productId))
    .get()

  // If product not found, disallow.
  if (!productRow) return false

  return productRow.reviewsEnabled
}
