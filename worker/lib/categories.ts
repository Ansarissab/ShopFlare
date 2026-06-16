// Category assembly helpers — tree building, slug lookup, product-id resolution,
// and parent validation. Used by GET /categories and admin category routes.

import { eq, inArray, and } from 'drizzle-orm'
import type { Database } from 'worker/db/index'
import * as schema from 'worker/db/schema'
import type { Category } from 'worker/db/schema'

// ─── Types ────────────────────────────────────────────────────────────────────

type CategoryNode = Category & { productCount: number; children: CategoryNode[] }

// ─── assembleCategoryTree ─────────────────────────────────────────────────────

/**
 * Builds the full category tree with productCounts and nested children.
 *
 * Query count: 1 (categories) + 1 (productCategories count) = 2 total.
 * Tree assembly is done in JS with O(n) Maps — no further DB round-trips.
 *
 * Supports max depth of 2 (parent → children) per the assertValidParent rule.
 */
export async function assembleCategoryTree(
  db: Database,
  opts: { includeInactive?: boolean } = {},
): Promise<CategoryNode[]> {
  // 1. Fetch all categories; storefront sees active only
  const baseQuery = db.select().from(schema.categories)
  const allCategories = await (
    opts.includeInactive ? baseQuery : baseQuery.where(eq(schema.categories.active, true))
  ).all()

  if (allCategories.length === 0) return []

  // 2. Count product assignments per category
  const allAssignments = await db.select().from(schema.productCategories).all()

  const countByCategory = new Map<string, number>()
  for (const row of allAssignments) {
    countByCategory.set(row.categoryId, (countByCategory.get(row.categoryId) ?? 0) + 1)
  }

  // 3. First pass — build node Map
  const nodeMap = new Map<string, CategoryNode>()
  for (const cat of allCategories) {
    nodeMap.set(cat.id, {
      ...cat,
      productCount: countByCategory.get(cat.id) ?? 0,
      children: [],
    })
  }

  // 4. Second pass — attach children to parents; collect roots
  const roots: CategoryNode[] = []
  for (const node of nodeMap.values()) {
    if (node.parentId !== null && node.parentId !== undefined) {
      const parent = nodeMap.get(node.parentId)
      if (parent) {
        parent.children.push(node)
      }
    } else {
      roots.push(node)
    }
  }

  // 5. Sort roots and children by sortOrder
  const bySort = (a: CategoryNode, b: CategoryNode) => a.sortOrder - b.sortOrder
  roots.sort(bySort)
  for (const root of roots) {
    root.children.sort(bySort)
  }

  return roots
}

// ─── resolveCategoryProductIds ────────────────────────────────────────────────

/**
 * Returns an ordered, de-duplicated list of productIds belonging to a category.
 * When includeDescendants is true, also includes products from direct children
 * (one level deep — depth-2 tree means grandchildren don't exist).
 *
 * De-duplication preserves first-seen order (parent rows come first when a
 * product appears in both parent and child).
 */
export async function resolveCategoryProductIds(
  db: Database,
  categoryId: string,
  opts: { includeDescendants?: boolean } = {},
): Promise<string[]> {
  // 1. Start with the requested category
  const categoryIds: string[] = [categoryId]

  // 2. Optionally add direct children
  if (opts.includeDescendants) {
    const children = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.parentId, categoryId))
      .all()

    for (const child of children) {
      categoryIds.push(child.id)
    }
  }

  // 3. Fetch product assignments ordered by sortOrder
  const assignments = await db
    .select()
    .from(schema.productCategories)
    .where(inArray(schema.productCategories.categoryId, categoryIds))
    .all()

  // 4. Sort by sortOrder then de-duplicate (preserve first-seen)
  assignments.sort((a, b) => a.sortOrder - b.sortOrder)

  const seen = new Set<string>()
  const result: string[] = []
  for (const row of assignments) {
    if (!seen.has(row.productId)) {
      seen.add(row.productId)
      result.push(row.productId)
    }
  }

  return result
}

// ─── getCategoryBySlug ────────────────────────────────────────────────────────

/**
 * Finds an active category by slug and builds its breadcrumb trail.
 * Breadcrumb is root-first: [parent?, category].
 * Returns null when the slug does not match any active category.
 */
export async function getCategoryBySlug(
  db: Database,
  slug: string,
): Promise<{ category: Category; breadcrumb: Category[] } | null> {
  // 1. Find the category
  const category = await db
    .select()
    .from(schema.categories)
    .where(and(eq(schema.categories.slug, slug), eq(schema.categories.active, true)))
    .get()

  if (!category) return null

  // 2. Build breadcrumb
  const breadcrumb: Category[] = []

  if (category.parentId) {
    const parent = await db
      .select()
      .from(schema.categories)
      .where(eq(schema.categories.id, category.parentId))
      .get()

    if (parent) breadcrumb.push(parent)
  }

  return { category, breadcrumb }
}

// ─── assertValidParent ────────────────────────────────────────────────────────

/**
 * Validates that a proposed parentId is legal before insert/update.
 * Throws a descriptive Error for any of these conditions:
 *   - parentId === selfId (self-parent cycle)
 *   - The parent itself has a parentId (would exceed depth-2 limit)
 *   - The parent category does not exist in D1
 *
 * Pass selfId only on update (omit / leave undefined on create).
 * Returns immediately when parentId is null/undefined (top-level category).
 */
export async function assertValidParent(
  db: Database,
  parentId: string | null | undefined,
  selfId?: string,
): Promise<void> {
  if (parentId === null || parentId === undefined) return

  if (selfId !== undefined && parentId === selfId) {
    throw new Error('A category cannot be its own parent.')
  }

  const parent = await db
    .select()
    .from(schema.categories)
    .where(eq(schema.categories.id, parentId))
    .get()

  if (!parent) {
    throw new Error(`Parent category "${parentId}" does not exist.`)
  }

  if (parent.parentId !== null && parent.parentId !== undefined) {
    throw new Error(
      `Parent category "${parent.name}" is already a child category. Nesting beyond depth 2 is not allowed.`,
    )
  }
}
