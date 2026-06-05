# Plan 13 — Categories (admin-managed taxonomy + storefront browse)

> **For the implementer (Sonnet):** Execute end-to-end. Follow CLAUDE.md DRY
> rules HARD. Categories are **fully merchant-managed from the Admin Dashboard**
> (Dynamic-First rule — no redeploy to add/edit/reorder/assign). Do NOT hardcode
> any UI string in JSX (→ `lib/i18n/en.ts`). Do NOT inline Zod (→ `lib/schemas`).
> Do NOT raw-`fetch` (→ `lib/api.ts`). All composite/prop types →
> `lib/types/*`. Small focused commits at the end (§14). Do **not** `git push`
> or open a PR.

---

## 1. Goal

Add a **category taxonomy** so the catalogue stays navigable as it grows.

Decisions (locked with the user):
- **Many-to-many** — a product can belong to multiple categories (join table).
- **Nested, 2 levels max** — a category may have a parent (`Men > Shirts`).
  Parent → child only; a child cannot itself be a parent (enforced).
- **Three storefront surfaces** — header dropdown nav, home filter chips, and
  dedicated `/category/[slug]` pages.

Everything (create, edit, reorder, nest, soft-delete, image, product
assignment) is driven from the **Admin Dashboard**. No code change to add a
category.

## 2. Current state (read first)

- Schema: `worker/db/schema.ts` — `text` PK (nanoid), `boolean` via
  `integer({mode:'boolean'})`, timestamps `default(sql\`(datetime('now'))\`)`,
  soft-delete via `active` flag, cascade FKs. Type exports at bottom (§ lines
  207-224).
- Public product read path: `worker/routes/products.ts` (ETag + `getDataVersion`
  fingerprint, `Cache-Control: no-cache`). Assembly batched in
  `worker/lib/products.ts` → `assembleProductList` (4 queries, `inArray`).
- Admin product CRUD: `worker/routes/admin/products.ts` (behind `requireAccess`,
  every mutation calls `bumpDataVersion(db)`). Aggregated in
  `worker/routes/admin/index.ts`; mounted in `worker/index.ts`.
- Zod: `src/lib/schemas/admin.ts` (compose from `base.ts`; `createX` +
  `updateX = createX.partial()`). Barrel `src/lib/schemas/index.ts`.
- Constants: `src/lib/constants/index.ts`.
- i18n: `src/lib/i18n/en.ts` (`admin.*`, `store.*` namespaces).
- Admin nav: `src/components/admin/shared/AdminSidebar.tsx` (`navItems`).
- Admin product form: `src/components/admin/products/ProductForm.tsx`.
- Storefront home: `src/app/(store)/page.tsx` (loads `/api/products`, grids
  `ProductCard`). Header: `src/components/store/StorefrontHeader.tsx`.
- API client: `src/lib/api.ts` (`apiGet/apiPost/apiPut/apiDelete/apiUpload`).
- UI primitives present: `dropdown-menu`, `select`, `checkbox`, `badge`. **No**
  command/combobox/popover — build the product multi-select from `checkbox` +
  `dropdown-menu` (no new dep).
- **No `slugify` helper exists** — add one (§5).
- Tests: Vitest. Worker unit (`worker/lib/*.test.ts`), worker integration
  (`worker/test/api.integration.test.ts`), schema (`src/lib/schemas/*.test.ts`),
  `vitest.config.ts` at root.

## 3. Data model

Two new tables in `worker/db/schema.ts`. Add after the `productImages` block.

```ts
import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'

// ─── Categories ───────────────────────────────────────────────────────────────

export const categories = sqliteTable('categories', {
  id:          text('id').primaryKey(),
  name:        text('name').notNull(),
  slug:        text('slug').notNull().unique(),
  description: text('description').notNull().default(''),
  // Self-reference. onDelete:'set null' → deleting a parent promotes its
  // children to top-level (never silently destroys a subtree).
  parentId:    text('parent_id').references((): AnySQLiteColumn => categories.id, { onDelete: 'set null' }),
  imageUrl:    text('image_url'),     // optional hero, like productImages.url
  r2Key:       text('r2_key'),        // R2 object key for the hero
  sortOrder:   integer('sort_order').notNull().default(0),
  active:      integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt:   text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt:   text('updated_at').notNull().default(sql`(datetime('now'))`),
})

// ─── Product ↔ Category (junction) ────────────────────────────────────────────

export const productCategories = sqliteTable('product_categories', {
  productId:  text('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  categoryId: text('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  sortOrder:  integer('sort_order').notNull().default(0), // product order WITHIN a category
}, (t) => ({
  pk: primaryKey({ columns: [t.productId, t.categoryId] }), // composite PK = no dup assignment
}))
```

Add to the type-export block (bottom of `schema.ts`):

```ts
export type Category = typeof categories.$inferSelect
export type NewCategory = typeof categories.$inferInsert
export type ProductCategory = typeof productCategories.$inferSelect
```

**Depth rule (2 levels):** structurally `parentId` could chain deeper; we forbid
it in validation/route logic — a category whose `parentId` references a category
that *already has* a non-null `parentId` is rejected (422). Top-level categories
have `parentId === null`.

### Migration

```bash
pnpm drizzle-kit generate    # emits worker/db/migrations/0005_*.sql
```
Review the generated SQL (expect `CREATE TABLE categories`, `product_categories`,
unique index on `slug`). Apply:
```bash
wrangler d1 migrations apply <DB> --local    # dev
wrangler d1 migrations apply <DB> --remote   # prod — USER runs this on deploy
```
> Implementer: generate + apply `--local` + commit the SQL. Do **not** touch
> remote; the user deploys.

## 4. Constants — `src/lib/constants/index.ts`

```ts
// ─── Categories ────────────────────────────────────────────────────────────────
export const MAX_CATEGORY_DEPTH = 2                  // parent → child only
export const MAX_CATEGORIES_PER_PRODUCT = 10
export const MAX_CATEGORY_NAME_LENGTH = 60
export const MAX_CATEGORY_DESCRIPTION_LENGTH = 500
// URL-safe slug: lowercase words joined by single hyphens, no leading/trailing -
export const CATEGORY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
```

## 5. Slug helper — `src/lib/utils/index.ts`

Add (reused by admin form auto-slug + server fallback):

```ts
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}
```
Add a unit test in `src/lib/utils.test.ts` (spaces, punctuation, unicode strip,
trailing hyphen).

## 6. Zod — `src/lib/schemas/admin.ts`

Compose from `base.ts` (`idField`) + constants. Add after the size-option block.

```ts
import {
  MAX_CATEGORY_NAME_LENGTH, MAX_CATEGORY_DESCRIPTION_LENGTH,
  MAX_CATEGORIES_PER_PRODUCT, CATEGORY_SLUG_PATTERN,
} from '@/lib/constants'

// ─── Category ──────────────────────────────────────────────────────────────────
export const createCategorySchema = z.object({
  name:        z.string().min(1).max(MAX_CATEGORY_NAME_LENGTH),
  // slug optional on create → server derives via slugify(name) when omitted
  slug:        z.string().min(1).max(80).regex(CATEGORY_SLUG_PATTERN).optional(),
  description: z.string().max(MAX_CATEGORY_DESCRIPTION_LENGTH).default(''),
  parentId:    idField.nullish(),   // null/omitted = top-level
  sortOrder:   z.number().int().nonnegative().default(0),
  active:      z.boolean().default(true),
})
export const updateCategorySchema = createCategorySchema.partial()

// Assign a product to N categories (used by PUT /admin/products/:id/categories)
export const setProductCategoriesSchema = z.object({
  categoryIds: z.array(idField).max(MAX_CATEGORIES_PER_PRODUCT).default([]),
})

// Reorder products within a category (drag-sort on the category detail page)
export const reorderCategoryProductsSchema = z.object({
  productIds: z.array(idField),   // new order, index = sortOrder
})
```

Add the `z.infer` type exports alongside the existing ones. (Barrel already
`export * from './admin'`.)

## 7. Types — `src/lib/types/`

- `product.ts` (storefront composites): add `categoryIds` to the product card
  payload so home chips filter **client-side** with no refetch.
  ```ts
  // assembleProductList now attaches categoryIds per product
  export interface ProductWithVariants {
    product: Product
    variants: VariantWithDetails[]
    categoryIds: string[]        // NEW
  }
  ```
  > Mirror the same field on `worker/lib/products.ts`'s `ProductWithVariants`
  > interface (it is declared there too — keep them identical).
- `admin.ts`: category admin/composite types.
  ```ts
  export type CategoryNode = Category & { productCount: number; children: CategoryNode[] }
  export interface CategoryTreeResponse { categories: CategoryNode[] }
  export interface CategoryDetailResponse { category: Category; products: ProductWithVariants[]; breadcrumb: Category[] }
  ```
- `store.ts`: **all `*Props`** for new components (DRY rule 3) — e.g.
  `CategoryNavProps`, `CategoryFilterProps`, `CategoryFormProps`,
  `CategoryTreeProps`, `CategoryImageUploadProps`, `ProductCategoryPickerProps`.

## 8. Worker lib — `worker/lib/categories.ts` (new)

Batched, mirrors `products.ts` style.

```ts
// assembleCategoryTree — active(+inactive for admin) categories as a 2-level
// tree with product counts. Queries: 1 categories + 1 productCategories = 2.
export async function assembleCategoryTree(
  db: Database, opts: { includeInactive?: boolean } = {},
): Promise<CategoryNode[]>

// resolveCategoryProductIds — all productIds in a category, optionally including
// its children's products (used by the category page so a parent shows its
// whole subtree). De-duplicated, ordered by productCategories.sortOrder.
export async function resolveCategoryProductIds(
  db: Database, categoryId: string, opts: { includeDescendants?: boolean } = {},
): Promise<string[]>

// getCategoryBySlug — category + breadcrumb (self → parent) or null
export async function getCategoryBySlug(db: Database, slug: string): Promise<{ category, breadcrumb } | null>

// assertValidParent — throws if parentId is self / already a child / missing
// (enforces the 2-level + no-cycle rule). Reused by POST + PUT.
export async function assertValidParent(db, parentId, selfId?): Promise<void>
```

**Extend `worker/lib/products.ts`:**
- `assembleProductList(db, opts)` gains `opts.productIds?: string[]` — when set,
  the base products query filters `inArray(products.id, productIds)` (still
  active-only unless `includeInactive`). Category page reuses this — no second
  assembly path.
- After building the list, run **one** extra batched query
  (`productCategories` `inArray(productId, ids)`) and attach `categoryIds[]` to
  each composite. Query budget goes 4 → 5, still O(1) in catalogue size.

## 9. Worker routes

### Public — `worker/routes/categories.ts` (new), mount `/api/categories`

```
GET /            → { categories: CategoryNode[] }  active tree + counts. ETag.
GET /:slug       → { category, products, breadcrumb }  products via
                   assembleProductList({ productIds: resolveCategoryProductIds(..., {includeDescendants:true}) }).
                   404 if not found / inactive. ETag.
```
Use the **same ETag pattern** as `routes/products.ts` (`etagFor` +
`getDataVersion`, honour `If-None-Match` → 304, `Cache-Control: no-cache`).

### Admin — `worker/routes/admin/categories.ts` (new), mount in `admin/index.ts`

Behind `requireAccess` (inherited from the aggregator). Every mutation calls
`bumpDataVersion(db)` (invalidates storefront ETags).

```
GET    /                 list full tree incl. inactive (admin management view)
GET    /:id              single category
POST   /                 create  (slug ← slugify(name) if omitted; assertValidParent; unique-slug check → 409)
PUT    /:id              update  (re-validate parent; if slug changes, unique check)
DELETE /:id              soft-delete (active=false). Children reparent to null
                         via the FK's onDelete:'set null' only on HARD delete —
                         for soft delete, also null out children's parentId
                         explicitly + bump. Keep R2 image (restorable).
POST   /:id/image        upload hero to R2 (multipart) — mirror products
                         /images/upload (validate ALLOWED_IMAGE_TYPES,
                         MAX_IMAGE_BYTES; key `categories/<id>/<nanoid>.<ext>`)
DELETE /:id/image        remove hero (R2 delete + null imageUrl/r2Key)
```

Slug collision → `409 { error: 'Slug already exists' }`. Depth/parent violation
→ `422`. Validation → `400 { error, issues }` (existing convention).

### Product ↔ category assignment — extend `worker/routes/admin/products.ts`

```
PUT /:id/categories   body: setProductCategoriesSchema { categoryIds }
```
Replaces the product's rows in `product_categories` (delete-all-then-insert in
order; `sortOrder` = index). Then bump **both** the product's `updatedAt`
**and** `bumpDataVersion(db)` (so `/api/products` payload — which now carries
`categoryIds` — re-fingerprints).

```
PUT /categories/:categoryId/reorder   body: reorderCategoryProductsSchema
```
Sets `productCategories.sortOrder` for each product in the given category.

> All four storefront/admin reads stay cache-correct because category writes and
> assignment writes both `bumpDataVersion`.

## 10. API client

No change. New calls reuse `apiGet('/api/categories')`,
`apiPost('/api/admin/categories', …)`, `apiPut('/api/admin/products/:id/categories', …)`,
`apiUpload('/api/admin/categories/:id/image', form)`, etc. Admin paths auto-send
the CF Access cookie (`credentials:'include'` for `/api/admin`).

## 11. Admin Dashboard (the management surface — make it complete)

### 11.1 Nav — `AdminSidebar.tsx`
Add to `navItems` after Products:
```ts
{ href: '/admin/categories', label: en.admin.categories, icon: FolderTree },
```
(`FolderTree` from `lucide-react`.)

### 11.2 Pages — `src/app/(admin)/admin/categories/`
- `page.tsx` — **management list**: tree view (parents with indented children),
  product-count badge, active/inactive badge, reorder controls, edit + delete,
  “Add Category” button. Loads `GET /api/admin/categories` via `useApiResource`.
- `new/page.tsx` — `CategoryForm` (create).
- `[id]/page.tsx` — `CategoryForm` (edit) **plus** an “Products in this category”
  panel: searchable product list with add/remove + drag-reorder
  (`PUT …/reorder`). This is the bulk-assignment workflow.

### 11.3 Components — `src/components/admin/categories/`
- `CategoryForm.tsx` — name, auto-slug (editable, live `slugify(name)` preview),
  description, **parent** `<select>` (top-level categories only; current
  category + its children excluded to prevent cycles), sortOrder, active toggle,
  optional hero image. Validation via `createCategorySchema`; surfaces `issues`
  + 409 slug-conflict as field errors. Toast on success (sonner). Reuse
  `AdminPageHeader` + `common/FormField`.
- `CategoryTree.tsx` — renders the nested list + reorder (↑/↓ or drag) → `PUT`
  sortOrder. Prop types in `lib/types/store.ts`.
- `CategoryImageUpload.tsx` — thin wrapper reusing the **same**
  `browser-image-compression` core as `products/ImageUpload.tsx` but posting to
  `/api/admin/categories/:id/image`. (ImageUpload is variant-coupled; do not
  fork its JSX wholesale — extract the compress+upload call if it makes the two
  converge, else keep this one minimal.)
- `CategoryProductsManager.tsx` — the assignment/reorder panel for `[id]` page.

### 11.4 Product form integration — `products/ProductForm.tsx`
Add a **“Categories”** section (after name/description): a multi-select built
from `checkbox` + `dropdown-menu` (no new dep), populated from
`GET /api/categories`, showing nested labels (`Men › Shirts`). On save, after the
product upsert, call `PUT /api/admin/products/:id/categories` with the chosen
ids. Pre-fill from the product’s existing `categoryIds`. Prop type
`ProductCategoryPickerProps` → `lib/types/store.ts`.

> Result: a merchant can assign categories **either** from the product page
> **or** from the category page — both write the same junction.

## 12. Storefront

### 12.1 Header dropdown nav — `StorefrontHeader.tsx`
`CategoryNav.tsx` (`src/components/store/categories/`): `dropdown-menu` listing
top-level categories with their children nested; each links to
`/category/[slug]`. Loads `GET /api/categories` (cache-friendly). Hidden when
zero categories.

### 12.2 Home filter chips — `src/app/(store)/page.tsx`
`CategoryFilter.tsx`: horizontal scrollable `badge`-style chips (“All” +
top-level categories) above the grid. Tapping sets a `?category=slug` param and
filters `items` **client-side** by `categoryIds` (payload already carries them
from §8) — no refetch, no layout flash. “All” clears. Keep the existing
single-product hero short-circuit (`items.length === 1`) when unfiltered only.

### 12.3 Category pages — `src/app/(store)/category/[slug]/page.tsx`
Loads `GET /api/categories/:slug`. Renders breadcrumb (`Home / [parent] /
[category]`), optional hero image + description, then the **same** `ProductCard`
grid as home (reuse, don’t duplicate the grid markup — consider lifting the grid
into a small shared `ProductGrid` if it reads cleanly). Add `CollectionPage` +
`BreadcrumbList` JSON-LD (mirror the existing `ProductJsonLd` approach). Empty
state via i18n. If a `sitemap.ts` exists, add category URLs.

## 13. i18n — `src/lib/i18n/en.ts`

Add to `admin.*`:
```
categories, addCategory, editCategory, deleteCategory,
deleteCategoryConfirm, categoryName, categorySlug, categoryDescription,
categoryParent, categoryParentNone, categorySortOrder, categoryActive,
categoryImage, categoryProducts, addProductsToCategory, noCategories,
categoryCreated, categoryUpdated, categoryDeleted, slugTaken, slugAutoHint
```
Add to `store.*`:
```
shopByCategory, allProducts, filterByCategory, viewCategory,
categoryEmpty, browseCategories
```
(English values plain; keys only listed here.)

## 14. Commit plan (small, focused, in order)

1. `feat(db): add categories + product_categories tables + migration`
2. `feat(constants): category limits + slug pattern`
3. `feat(utils): slugify helper + tests`
4. `feat(schemas): category + product-assignment Zod schemas`
5. `feat(types): category composites + categoryIds on product payload`
6. `feat(worker/lib): category tree/resolve helpers + categoryIds in assembleProductList`
7. `feat(worker): public /api/categories routes (tree + by-slug, ETag)`
8. `feat(worker/admin): category CRUD + image + product-assignment/reorder routes`
9. `feat(admin): categories nav + list/new/edit pages + CategoryForm/Tree`
10. `feat(admin): CategoryProductsManager + ProductForm category picker`
11. `feat(store): header CategoryNav + home CategoryFilter chips`
12. `feat(store): /category/[slug] pages + JSON-LD + sitemap`
13. `feat(i18n): category strings (admin + store)`
14. `test: category route + tree/depth/slug + product-filter coverage`

## 15. Test checklist (§14.14)

- Slug: `slugify` edge cases; duplicate slug → 409; auto-derive on create.
- Depth: assigning a parent that already has a parent → 422; self-parent → 422.
- Soft-delete a parent → children’s `parentId` nulled, products untouched.
- `assembleProductList({productIds})` filters correctly + attaches `categoryIds`.
- `/api/categories/:slug` includes descendant products; 404 on inactive/missing.
- Assignment replaces junction rows + bumps version (storefront ETag changes).
- Admin routes 401 without CF Access (integration test pattern).

## 16. Out of scope (note, don’t build)

- 3+ level nesting, per-category SEO meta overrides, category-scoped coupons,
  drag-drop between categories on the product grid, mega-menu imagery.
  All sit cleanly on this schema later.
</content>
</invoke>
