# Plan 15 — Search, Pagination & Real-time Products

> **For the implementer (Sonnet):** Execute end-to-end. Follow CLAUDE.md DRY rules.
> All strings → `lib/i18n/en.ts`. No new raw `fetch()`. Types → `lib/types/`.
> No new DB tables unless explicitly noted. Do **not** `git push` or open a PR.

---

## 1. Goal

Add comprehensive product **search**, **infinite-scroll pagination**, and
**real-time data freshness** to the storefront home page and category pages.
An admin-configurable page size (stored in D1) drives how many products load
per scroll batch.

Decisions locked with the user:
- **Client-side search** via Fuse.js (already installed) — no new API endpoints.
- **Infinite scroll**, default **24 products per batch**, IntersectionObserver
  (no library), idempotent (guard with `isLoading` flag).
- **Admin-configurable page size** — stored in `storeConfig` D1 table as key
  `productPageSize` (integer, default 24). Editable from Admin → Settings.
- **Real-time**: `useApiResource` extended with `refetchInterval` option
  (polling every 60 s) + existing `refetchOnFocus` for instant on-tab-switch.
- **URL state**: `?q=keyword&category=slug` — shareable links, no full reload.

---

## 2. Current state

- Fuse.js 7.4.1 is already installed in `package.json`.
- `useApiResource` (`src/hooks/useApiResource.ts`) already supports
  `refetchOnFocus` and `refetchOnChannel`. Needs `refetchInterval` added.
- `storeConfig` table: key/value pairs in D1 (see `worker/db/schema.ts`).
  Admin Settings page already reads/writes it via `GET/PUT /api/admin/config`.
- Home page (`src/app/(store)/page.tsx`) already uses `useApiResource` for
  products + categories. CategoryFilter chips are in place (Phase 13).
- `ProductGrid` (`src/components/store/product/ProductGrid.tsx`) is the shared
  grid component. Category page also uses it.
- `src/lib/constants/index.ts` — add `DEFAULT_PRODUCT_PAGE_SIZE = 24`.
- `src/lib/i18n/en.ts` — add search/pagination keys.

---

## 3. Constants — `src/lib/constants/index.ts`

```ts
// ─── Search + pagination ───────────────────────────────────────────────────────
export const DEFAULT_PRODUCT_PAGE_SIZE = 24
export const MIN_PRODUCT_PAGE_SIZE = 6
export const MAX_PRODUCT_PAGE_SIZE = 96
export const SEARCH_DEBOUNCE_MS = 250
```

---

## 4. i18n — `src/lib/i18n/en.ts`

Add to `store.*`:
```
searchProducts: 'Search products…',
searchNoResults: 'No products found for',
searchClearHint: 'Clear search',
loadingMore: 'Loading more…',
allProductsLoaded: 'All products loaded',
```

Add to `admin.*`:
```
productPageSize: 'Products per page',
productPageSizeHint: 'Number of products loaded per scroll batch (6–96)',
```

---

## 5. Admin: page-size setting in D1

### 5.1 Worker — `worker/routes/admin/config.ts`

The config route already handles arbitrary `storeConfig` key updates. No new
routes needed — `PUT /api/admin/config` with `{ productPageSize: 24 }` will
save the value.

### 5.2 Admin Settings page — `src/app/(admin)/admin/settings/page.tsx`

Read the current settings page. Add a **"Products per page"** field (number
input, min=`MIN_PRODUCT_PAGE_SIZE`, max=`MAX_PRODUCT_PAGE_SIZE`, step=6,
default=`DEFAULT_PRODUCT_PAGE_SIZE`) to the existing settings form. Save via
the same config PUT call the form already uses.

Label: `en.admin.productPageSize`. Hint: `en.admin.productPageSizeHint`.

---

## 6. `useApiResource` — add `refetchInterval`

Add to `UseApiResourceOptions`:
```ts
refetchInterval?: number  // ms; if set, re-fetch on that interval (background)
```

In the hook, add a `useEffect` that sets an `setInterval` calling
`setRefetchKey(k => k + 1)` every `opts.refetchInterval` ms. Clears on
unmount. Guard: only set if `opts.refetchInterval` is defined and > 0.

---

## 7. `useStoreConfig` — expose `productPageSize`

`src/hooks/useStoreConfig.ts` already fetches `/api/config/store`. Add
`productPageSize?: number` to its return type and read it from the config
response (default to `DEFAULT_PRODUCT_PAGE_SIZE` if absent).

---

## 8. Search + pagination hook — `src/hooks/useProductSearch.ts` (new)

Encapsulates Fuse.js search + client-side category filtering + paginated slicing.
Keeps home page and category page lean.

```ts
import Fuse from 'fuse.js'

interface UseProductSearchOpts {
  items: ProductWithVariants[]       // full loaded list
  pageSize: number
  // Controlled externally (from URL params)
  query: string
  activeCategoryId: string | null    // null = "All"
  allCategories: CategoryNode[]      // for descendant-id expansion
}

interface UseProductSearchResult {
  visibleItems: ProductWithVariants[]  // current paginated + filtered slice
  hasMore: boolean
  loadMore: () => void
  isLoadingMore: boolean
  totalFiltered: number
}

export function useProductSearch(opts: UseProductSearchOpts): UseProductSearchResult
```

Internals:
1. Build `fuseInstance = useMemo(() => new Fuse(items, { keys: ['product.name','product.description', 'variants.label'], threshold: 0.35 }), [items])`
2. `filtered = useMemo(...)`:
   a. If `query`, run Fuse search → get matching items.
   b. If `activeCategoryId`, filter by `categoryIds` (include descendant ids — reuse the tree-walk logic from Phase 13 home page).
   c. Both filters combine (AND).
3. Pagination state: `page` (number, starts at 1). `visibleItems = filtered.slice(0, page * pageSize)`. `hasMore = visibleItems.length < filtered.length`.
4. `loadMore`: if `!isLoadingMore && hasMore`, set `isLoadingMore = true`, `setPage(p => p + 1)`, then `setIsLoadingMore(false)` in a `useEffect` (or just synchronous — slicing is instant).
5. Reset `page` to 1 whenever `query` or `activeCategoryId` changes.

---

## 9. `SearchBar` component — `src/components/store/search/SearchBar.tsx` (new)

```ts
interface SearchBarProps {
  value: string
  onChange: (value: string) => void
}
```

- A `<input type="search">` with a search icon (lucide `Search`) and a clear
  button (lucide `X`, shown when `value` is non-empty).
- Debounced: internal state updates immediately; calls `onChange` after
  `SEARCH_DEBOUNCE_MS` (use `useEffect` + `setTimeout` cleanup).
- Placeholder: `en.store.searchProducts`.
- Styled to match the storefront design system (Tailwind, CSS vars from `globals.css`).
- Mobile-responsive: full-width on small screens.

---

## 10. `InfiniteScrollSentinel` — `src/components/shared/InfiniteScrollSentinel.tsx` (new)

```ts
interface InfiniteScrollSentinelProps {
  onVisible: () => void
  isLoading: boolean
  hasMore: boolean
}
```

- Renders a `<div ref={sentinelRef}>` at the end of the grid.
- `useEffect` that sets up an `IntersectionObserver` on `sentinelRef`. When
  `isIntersecting && !isLoading && hasMore`, calls `onVisible()`.
- Shows `en.store.loadingMore` spinner when `isLoading && hasMore`.
- Shows `en.store.allProductsLoaded` when `!hasMore && totalItems > pageSize`.
- Disconnect observer on unmount.
- **Idempotent**: the `isLoading` guard prevents firing more than once per batch.

---

## 11. Home page — `src/app/(store)/page.tsx`

Replace the current inline filtering with `useProductSearch`. Add `SearchBar`.
Wire `refetchInterval: 60_000` on the products `useApiResource` call.

**URL state management** (already partially in place for category from Phase 13):
- `searchParams.get('q')` → initial search query.
- `searchParams.get('category')` → initial category slug.
- On search change: `router.replace` with updated `?q=...&category=...` params.
- Convert `activeCategorySlug` → `activeCategoryId` by finding the matching node in `allCategories`.

**Render order** (top to bottom):
1. `<SearchBar>` — above `<CategoryFilter>`.
2. `<CategoryFilter>` — chips (Phase 13, already there).
3. Result count line: `"Showing N products"` (or `"No products found for 'x'"` when query + zero results).
4. `<ProductGrid items={visibleItems} storeConfig={storeConfig} />`.
5. `<InfiniteScrollSentinel onVisible={loadMore} isLoading={isLoadingMore} hasMore={hasMore} />`.

The single-product hero short-circuit stays, but only when no search query AND no active category AND `items.length === 1`.

**`pageSize`**: read from `useStoreConfig().productPageSize ?? DEFAULT_PRODUCT_PAGE_SIZE`.

---

## 12. Category page — `src/app/(store)/category/[slug]/page.tsx`

The category page already shows a filtered product list (all products in the
category are returned by the server). Add:

1. `SearchBar` above the grid to search within the category's products.
2. `useProductSearch` with the category's products as `items`, `activeCategoryId: null`
   (server already filtered), `query` from `?q=` URL param.
3. `InfiniteScrollSentinel` below the grid.
4. `pageSize` from `useStoreConfig`.

No `?category=` URL param needed here (category is already in the route).

---

## 13. Types — `src/lib/types/`

Add to `src/lib/types/store.ts` (or a new `search.ts` re-exported from index):
```ts
export interface SearchBarProps {
  value: string
  onChange: (value: string) => void
}

export interface InfiniteScrollSentinelProps {
  onVisible: () => void
  isLoading: boolean
  hasMore: boolean
  totalItems?: number
  pageSize?: number
}
```

---

## 14. Commit plan

1. `feat(constants): search + pagination limits`
2. `feat(i18n): search + pagination + admin page-size strings`
3. `feat(hooks): refetchInterval option on useApiResource`
4. `feat(hooks): useStoreConfig exposes productPageSize`
5. `feat(admin): productPageSize setting in Admin Settings`
6. `feat(search): useProductSearch hook (Fuse.js + category filter + pagination)`
7. `feat(store): SearchBar component`
8. `feat(store): InfiniteScrollSentinel component`
9. `feat(store): home page — search + infinite scroll + real-time refetch`
10. `feat(store): category page — search within category + infinite scroll`

---

## 15. Test checklist

- `useProductSearch`: Fuse.js finds by name partial match; category filter
  excludes unmatched; combined query+category narrows correctly; `loadMore`
  advances page; resetting query resets page.
- `SearchBar`: debounce fires after `SEARCH_DEBOUNCE_MS`, not on every keystroke.
- `InfiniteScrollSentinel`: `onVisible` not called when `isLoading=true`.
- `productPageSize` persists via admin config PUT + shows on storefront.

---

## 16. Out of scope (Phase 15 only)

- Server-side full-text search (D1 FTS5) — for catalogues > 1000 products.
- Search analytics / popular queries.
- Saved searches.
- Drag-and-drop reorder on the storefront grid.
