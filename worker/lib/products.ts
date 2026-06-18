// Shared product-assembly helpers — build ProductWithVariants composites
// from D1 for use by GET /products and GET /products/:id.

import { eq, inArray, and, asc, sql, ne } from 'drizzle-orm'
import type { Database } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import type { Product, Variant, ProductImage, SizeOption } from 'worker/db/schema'
import type { ProductSearchItem } from '@/lib/types/search'
import type { ProductSalesStats } from '@/lib/types/admin'
import { faqItemSchema } from '@/lib/schemas'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VariantWithDetails extends Variant {
  images: ProductImage[]
  sizes: SizeOption[]
}

export interface ProductWithVariants {
  product: Product
  variants: VariantWithDetails[]
  categoryIds: string[]
  /** Parsed faqItems (JSON string → array). Empty array when none stored. */
  faqItems: { question: string; answer: string }[]
}

// ─── parseFaqItems ────────────────────────────────────────────────────────────

/**
 * Parses the faq_items JSON text column into a validated array of FAQ items.
 * Returns [] when the value is absent, null, or fails validation.
 */
function parseFaqItems(raw: string | null): { question: string; answer: string }[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((m) => faqItemSchema.safeParse(m).success) as {
      question: string
      answer: string
    }[]
  } catch {
    return []
  }
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
    const images = (imagesByVariant.get(variant.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder)
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
    activeFilter && idFilter ? and(activeFilter, idFilter) : (activeFilter ?? idFilter)

  // ORDER BY created_at ASC keeps products in creation order across requests.
  // rowid ASC is the tiebreak for rows inserted within the same second (e.g. the
  // demo seed, which runs in one transaction). Together they produce a fully
  // stable, deterministic order that matches the current de-facto display order
  // (insertion order) — no visible catalog change for end users.
  const activeProducts = await (
    whereClause
      ? db.select().from(schema.products).where(whereClause)
      : db.select().from(schema.products)
  )
    .orderBy(asc(schema.products.createdAt), asc(sql`rowid`))
    .all()

  if (activeProducts.length === 0) return []

  const productIds = activeProducts.map((p) => p.id)

  // Each D1 query is a cross-region round-trip, so the batched reads are run in
  // dependency WAVES, parallelizing the independent ones (was 5 sequential reads):
  //   wave A: variants + category assignments (both keyed on productIds)
  //   wave B: images + size options (both keyed on variantIds, known after wave A)
  // This collapses ~5 round-trips to ~3 — lower TTFB with no caching/staleness.
  const [allVariants, categoryAssignments] = await Promise.all([
    db.select().from(schema.variants).where(inArray(schema.variants.productId, productIds)).all(),
    db
      .select()
      .from(schema.productCategories)
      .where(inArray(schema.productCategories.productId, productIds))
      .all(),
  ])

  // Build map: productId → categoryId[]
  const categoryIdsByProduct = new Map<string, string[]>()
  for (const row of categoryAssignments) {
    const arr = categoryIdsByProduct.get(row.productId) ?? []
    arr.push(row.categoryId)
    categoryIdsByProduct.set(row.productId, arr)
  }

  if (allVariants.length === 0) {
    return activeProducts.map((product) => ({
      product,
      variants: [],
      categoryIds: categoryIdsByProduct.get(product.id) ?? [],
      faqItems: parseFaqItems(product.faqItems),
    }))
  }

  const variantIds = allVariants.map((v) => v.id)

  const [allImages, allSizes] = await Promise.all([
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
  ])

  // 6. Group in JS — O(n) Maps, no further DB round-trips
  return activeProducts.map((product) => ({
    product,
    variants: groupVariants(allVariants, allImages, allSizes, product.id),
    categoryIds: categoryIdsByProduct.get(product.id) ?? [],
    faqItems: parseFaqItems(product.faqItems),
  }))
}

// ─── getProductSalesMap ───────────────────────────────────────────────────────

/**
 * Returns a Map<productId, ProductSalesStats> for the given product IDs.
 * One batched aggregate query — no N+1. Excludes cancelled orders.
 * Products with zero sales are absent from the map; callers should default to 0.
 */
export async function getProductSalesMap(
  db: Database,
  productIds: string[],
): Promise<Map<string, ProductSalesStats>> {
  if (productIds.length === 0) return new Map()

  const rows = await db
    .select({
      productId: schema.orderItems.productId,
      unitsSold: sql<number>`COALESCE(SUM(${schema.orderItems.quantity}), 0)`,
      revenueCents: sql<number>`COALESCE(SUM(${schema.orderItems.quantity} * ${schema.orderItems.priceCents}), 0)`,
    })
    .from(schema.orderItems)
    .innerJoin(schema.orders, eq(schema.orderItems.orderId, schema.orders.id))
    .where(
      and(inArray(schema.orderItems.productId, productIds), ne(schema.orders.status, 'cancelled')),
    )
    .groupBy(schema.orderItems.productId)
    .all()

  const map = new Map<string, ProductSalesStats>()
  for (const row of rows) {
    map.set(row.productId, { unitsSold: row.unitsSold, revenueCents: row.revenueCents })
  }
  return map
}

// ─── assembleSearchIndex ──────────────────────────────────────────────────────

/**
 * Builds a compact search-index payload for all ACTIVE products.
 * Used by GET /api/products/search-index — one Fuse-searchable row per product.
 *
 * Query count: 1 (products) + 1 (variants) + 1 (images, 1 per product) +
 *              1 (sizes, active only) + 1 (category assignments) = 5 total.
 * Never N+1 — mirrors assembleProductList's batched approach.
 */
export async function assembleSearchIndex(db: Database): Promise<ProductSearchItem[]> {
  // 1. All active products — same stable order as assembleProductList
  const activeProducts = await db
    .select()
    .from(schema.products)
    .where(eq(schema.products.active, true))
    .orderBy(asc(schema.products.createdAt), asc(sql`rowid`))
    .all()

  if (activeProducts.length === 0) return []

  const productIds = activeProducts.map((p) => p.id)

  // 2. All variants for these products
  const allVariants = await db
    .select()
    .from(schema.variants)
    .where(inArray(schema.variants.productId, productIds))
    .all()

  if (allVariants.length === 0) {
    return activeProducts.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description || null,
      thumbnailUrl: null,
      priceCents: 0,
      categoryIds: [],
      inStock: false,
      variantLabels: [],
    }))
  }

  const variantIds = allVariants.map((v) => v.id)

  // 3. Batch: one thumbnail per product — only the lowest-sortOrder image per variant,
  //    then pick the first across all variants (lowest sortOrder variant first).
  const allImages = await db
    .select()
    .from(schema.productImages)
    .where(inArray(schema.productImages.variantId, variantIds))
    .all()

  // 4. Batch: active size options (for priceCents + inStock)
  const allSizes = await db
    .select()
    .from(schema.sizeOptions)
    .where(inArray(schema.sizeOptions.variantId, variantIds))
    .all()

  // 5. Batch: category assignments
  const categoryAssignments = await db
    .select()
    .from(schema.productCategories)
    .where(inArray(schema.productCategories.productId, productIds))
    .all()

  // ── Build Maps ───────────────────────────────────────────────────────────────

  // variantId → images sorted by sortOrder
  const imagesByVariant = new Map<string, ProductImage[]>()
  for (const img of allImages) {
    const arr = imagesByVariant.get(img.variantId) ?? []
    arr.push(img)
    imagesByVariant.set(img.variantId, arr)
  }

  // variantId → active sizes
  const sizesByVariant = new Map<string, SizeOption[]>()
  for (const sz of allSizes) {
    if (!sz.active) continue
    const arr = sizesByVariant.get(sz.variantId) ?? []
    arr.push(sz)
    sizesByVariant.set(sz.variantId, arr)
  }

  // productId → categoryId[]
  const categoryIdsByProduct = new Map<string, string[]>()
  for (const row of categoryAssignments) {
    const arr = categoryIdsByProduct.get(row.productId) ?? []
    arr.push(row.categoryId)
    categoryIdsByProduct.set(row.productId, arr)
  }

  // productId → variants sorted by sortOrder
  const variantsByProduct = new Map<string, Variant[]>()
  for (const v of allVariants) {
    const arr = variantsByProduct.get(v.productId) ?? []
    arr.push(v)
    variantsByProduct.set(v.productId, arr)
  }

  // ── Assemble ─────────────────────────────────────────────────────────────────

  return activeProducts.map((product) => {
    const variants = (variantsByProduct.get(product.id) ?? []).sort(
      (a, b) => a.sortOrder - b.sortOrder,
    )

    // Thumbnail: first image of the first (lowest-sortOrder) variant
    let thumbnailUrl: string | null = null
    for (const v of variants) {
      const imgs = (imagesByVariant.get(v.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder)
      if (imgs.length > 0) {
        thumbnailUrl = imgs[0].url
        break
      }
    }

    // inStock + priceCents: aggregate across all variants.
    // Mirrors getPriceRange semantics: prefer min price among active+in-stock
    // sizes; fall back to min across all active sizes when every size is
    // out-of-stock, so priceCents is never 0/empty while a price exists.
    let inStock = false
    let minInStockPrice = Infinity
    let minFallbackPrice = Infinity

    for (const v of variants) {
      const sizes = sizesByVariant.get(v.id) ?? []
      for (const sz of sizes) {
        // sizesByVariant only holds active sizes (filtered in build-maps above)
        if (sz.stock !== 0) {
          inStock = true
          if (sz.priceCents < minInStockPrice) minInStockPrice = sz.priceCents
        }
        if (sz.priceCents < minFallbackPrice) minFallbackPrice = sz.priceCents
      }
    }

    const priceCents =
      minInStockPrice !== Infinity
        ? minInStockPrice
        : minFallbackPrice !== Infinity
          ? minFallbackPrice
          : 0

    // variantLabels: unique, non-empty labels across all variants
    const variantLabels = [...new Set(variants.map((v) => v.label).filter(Boolean))]

    return {
      id: product.id,
      name: product.name,
      description: product.description || null,
      thumbnailUrl,
      priceCents,
      categoryIds: categoryIdsByProduct.get(product.id) ?? [],
      inStock,
      variantLabels,
    }
  })
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

  if (variantRows.length === 0) {
    return { product, variants: [], categoryIds: [], faqItems: parseFaqItems(product.faqItems) }
  }

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
    faqItems: parseFaqItems(product.faqItems),
  }
}
