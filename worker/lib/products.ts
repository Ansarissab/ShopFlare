// Shared product-assembly helpers — build ProductWithVariants composites
// from D1 for use by GET /products and GET /products/:id.

import { eq, inArray, and } from 'drizzle-orm'
import type { Database } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import type { Product, Variant, ProductImage, SizeOption } from 'worker/db/schema'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VariantWithDetails extends Variant {
  images: ProductImage[]
  sizes: SizeOption[]
}

export interface ProductWithVariants {
  product: Product
  variants: VariantWithDetails[]
  categoryIds: string[]
}

// ─── groupVariants ────────────────────────────────────────────────────────────

/**
 * Given flat arrays of variants, images, and sizes (already fetched in bulk),
 * groups them into VariantWithDetails[] for a single product, preserving the
 * existing sort-order rules:
 *   - variants: ascending sortOrder
 *   - images: ascending sortOrder
 *   - sizes: active only (no sort required — matches original filter)
 */
function groupVariants(
  variantRows: Variant[],
  imageRows: ProductImage[],
  sizeRows: SizeOption[],
  productId: string,
): VariantWithDetails[] {
  // Build Maps keyed by variantId for O(1) lookup
  const imagesByVariant = new Map<string, ProductImage[]>()
  const sizesByVariant = new Map<string, SizeOption[]>()

  for (const img of imageRows) {
    const arr = imagesByVariant.get(img.variantId) ?? []
    arr.push(img)
    imagesByVariant.set(img.variantId, arr)
  }

  for (const sz of sizeRows) {
    const arr = sizesByVariant.get(sz.variantId) ?? []
    arr.push(sz)
    sizesByVariant.set(sz.variantId, arr)
  }

  const productVariants = variantRows
    .filter((v) => v.productId === productId)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  return productVariants.map((variant) => {
    const images = (imagesByVariant.get(variant.id) ?? []).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    )
    const sizes = (sizesByVariant.get(variant.id) ?? []).filter((s) => s.active)

    return { ...variant, images, sizes }
  })
}

// ─── assembleProductList ──────────────────────────────────────────────────────

/**
 * Builds the full list of active products with variants/images/sizes using
 * BATCHED queries — one inArray per table rather than N+1 per variant.
 *
 * Query count: 1 (products) + 1 (variants inArray) + 1 (images inArray)
 *              + 1 (sizes inArray) = 4 total, regardless of catalogue size.
 *
 * Output shape is identical to the previous Promise.all(assembleProduct) loop.
 */
export async function assembleProductList(
  db: Database,
  opts: { includeInactive?: boolean; productIds?: string[] } = {},
): Promise<ProductWithVariants[]> {
  // 1. Fetch products — storefront sees active only; admin passes
  //    includeInactive to also surface soft-deleted products (so they can be
  //    re-activated rather than vanishing forever).
  //    When productIds is provided, restrict to that set (category filtering).
  if (opts.productIds !== undefined && opts.productIds.length === 0) return []

  const activeFilter = opts.includeInactive ? undefined : eq(schema.products.active, true)
  const idFilter =
    opts.productIds !== undefined && opts.productIds.length > 0
      ? inArray(schema.products.id, opts.productIds)
      : undefined

  const whereClause =
    activeFilter && idFilter
      ? and(activeFilter, idFilter)
      : activeFilter ?? idFilter

  const activeProducts = await (whereClause
    ? db.select().from(schema.products).where(whereClause)
    : db.select().from(schema.products)
  ).all()

  if (activeProducts.length === 0) return []

  const productIds = activeProducts.map((p) => p.id)

  // 2. Batch: all variants for these products
  const allVariants = await db
    .select()
    .from(schema.variants)
    .where(inArray(schema.variants.productId, productIds))
    .all()

  if (allVariants.length === 0) {
    return activeProducts.map((product) => ({ product, variants: [], categoryIds: [] }))
  }

  const variantIds = allVariants.map((v) => v.id)

  // 3. Batch: all images for these variants
  const allImages = await db
    .select()
    .from(schema.productImages)
    .where(inArray(schema.productImages.variantId, variantIds))
    .all()

  // 4. Batch: all size options for these variants (active filter applied in groupVariants)
  const allSizes = await db
    .select()
    .from(schema.sizeOptions)
    .where(inArray(schema.sizeOptions.variantId, variantIds))
    .all()

  // 5. Batch: category assignments for these products
  const allProductIds = activeProducts.map((p) => p.id)
  const categoryAssignments = await db
    .select()
    .from(schema.productCategories)
    .where(inArray(schema.productCategories.productId, allProductIds))
    .all()

  // Build map: productId → categoryId[]
  const categoryIdsByProduct = new Map<string, string[]>()
  for (const row of categoryAssignments) {
    const arr = categoryIdsByProduct.get(row.productId) ?? []
    arr.push(row.categoryId)
    categoryIdsByProduct.set(row.productId, arr)
  }

  // 6. Group in JS — O(n) Maps, no further DB round-trips
  return activeProducts.map((product) => ({
    product,
    variants: groupVariants(allVariants, allImages, allSizes, product.id),
    categoryIds: categoryIdsByProduct.get(product.id) ?? [],
  }))
}

// ─── assembleProduct ─────────────────────────────────────────────────────────

/**
 * Loads one product's variants, their images, and active size options from D1.
 * Used by GET /products/:id — single-product path; N+1 is acceptable here
 * since variant counts are small (≤5 per schema constants).
 *
 * Reuses groupVariants so the output shape is identical to assembleProductList.
 */
export async function assembleProduct(
  db: Database,
  product: Product,
): Promise<ProductWithVariants> {
  // Load variants ordered by sortOrder
  const variantRows = await db
    .select()
    .from(schema.variants)
    .where(eq(schema.variants.productId, product.id))
    .all()

  if (variantRows.length === 0) return { product, variants: [], categoryIds: [] }

  const variantIds = variantRows.map((v) => v.id)

  // Batch images + sizes + category assignments for this single product's variants
  const [imageRows, sizeRows, catRows] = await Promise.all([
    db
      .select()
      .from(schema.productImages)
      .where(inArray(schema.productImages.variantId, variantIds))
      .all(),
    db
      .select()
      .from(schema.sizeOptions)
      .where(inArray(schema.sizeOptions.variantId, variantIds))
      .all(),
    db
      .select()
      .from(schema.productCategories)
      .where(eq(schema.productCategories.productId, product.id))
      .all(),
  ])

  return {
    product,
    variants: groupVariants(variantRows, imageRows, sizeRows, product.id),
    categoryIds: catRows.map((r) => r.categoryId),
  }
}
