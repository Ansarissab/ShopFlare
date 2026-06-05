# Plan 11 — Mobile Responsiveness Pass (storefront + admin)

> **For the implementer (Sonnet):** Execute this end-to-end. Follow CLAUDE.md DRY
> rules. Tailwind is **mobile-first** — the unprefixed class is the phone style;
> add `sm:`/`md:`/`lg:` for larger screens. Reuse `lib/styles.ts` (`layout.*`,
> `safeArea.*`) and existing shadcn primitives — do NOT invent new infra. Commit
> in the small focused commits at the end. Do **not** `git push` or open a PR.

---

## 1. Goal

Make every screen usable on a 360px phone with no horizontal overflow, no
clipped controls, and touch targets ≥ 40px. Two surfaces:

- **Storefront** `(store)` — already partly responsive; tighten the gaps.
- **Admin dashboard** `(admin)` — built desktop-first; the **sidebar never
  collapses** and **data tables overflow**. This is the real work.

Breakpoints in use: `sm` 640 / `md` 768 / `lg` 1024. Keep it to these.

## 2. Test method (do this before + after each commit)

```bash
pnpm dev
```
Then in browser devtools device toolbar check **360px** and **768px** for:
storefront home, product page, cart sheet, checkout, order tracking; admin
dashboard, products list, product form, orders table, POS, coupons, settings,
analytics. Look for: horizontal scrollbar on `<body>`, controls off-screen,
text clipped, tap targets too small.

---

## 3. CRITICAL — Admin shell (do first, everything else sits inside it)

The admin sidebar is always rendered at `w-56` with no mobile hide. On a phone
it eats the screen. Fix = hide the persistent sidebar below `md`, add a
hamburger that opens the same nav in a `Sheet` drawer.

### 3a. `src/components/admin/shared/AdminSidebar.tsx`
- Extract `navItems` + the rendered `<nav>` link list into a small inner
  `SidebarNav({ collapsed, onNavigate })` so the **same list** feeds both the
  desktop `<aside>` and the mobile drawer (DRY — one nav source).
- Desktop `<aside>` (line 28): add `hidden md:flex`. Keep collapse toggle.
- Add a `MobileAdminNav` export (or co-located component) using shadcn
  `Sheet` (`src/components/ui/sheet.tsx`) with `side="left"`, trigger = a
  hamburger `Button variant="ghost" size="icon"` with `Menu` icon (lucide).
  On link click call `onNavigate` to close the sheet (`useState` open).
  Sheet content reuses `SidebarNav` (always expanded inside the drawer).

### 3b. `src/app/(admin)/admin/layout.tsx`
- Main padding (line 14): `p-6` → `p-4 sm:p-6`.
- Render the mobile nav trigger. Cleanest: a slim top bar visible only `md:hidden`
  inside the content column holding the `MobileAdminNav` trigger + "Admin" label,
  so phones get a header with the hamburger. Desktop unchanged.

### 3c. `src/components/admin/shared/AdminPageHeader.tsx`
- Negative margins must match the layout padding or they overflow. Line 9:
  `-mx-6 -mt-6 ... px-6` → `-mx-4 sm:-mx-6 -mt-4 sm:-mt-6 ... px-4 sm:px-6`.
- Title `text-xl` is fine. If `actions` wrap, allow it: add `flex-wrap gap-2`
  to the actions container, and `gap-2 sm:gap-3` on the title row.

**Commit 1:** `feat(admin): collapsible mobile sidebar drawer + responsive shell`

---

## 4. HIGH — Admin data tables (overflow on phones)

Pattern to apply to every admin table. Tables already sit in
`overflow-x-auto` wrappers in most cases (keep that as the floor — horizontal
scroll beats clipping). On top of it, **hide low-priority columns below `sm`/`md`**
so the default view fits. Use `hidden sm:table-cell` / `hidden md:table-cell`
on BOTH the `<th>` and the matching `<td>`.

| File | Keep on mobile | Hide `sm:`/`md:` |
|------|----------------|------------------|
| `components/admin/orders/OrdersTable.tsx` | Order, Status, Total | Customer email line (`hidden sm:block`), Method, Date |
| `components/admin/coupons/CouponsTable.tsx` | Code, Value, Active, actions | Type, Uses, Expires, Stripe |
| `app/(admin)/admin/reviews/page.tsx` (+ `AdminReviewRow.tsx`) | Product, Rating, actions | Status, Review text (`max-w-[60vw] sm:max-w-xs`), Customer, Date |
| `app/(admin)/admin/analytics/page.tsx` Top Products + Coupon tables | name (`truncate min-w-0`), revenue | secondary metric cols; padding `px-2 sm:px-5` |
| `components/admin/analytics/CustomersTab.tsx` | Customer, Spent | Orders, First Order, Last Order |
| `components/admin/analytics/FunnelTab.tsx` | Customer, Revenue | Contact, timestamp |
| `components/admin/analytics/ProductsTab.tsx` (4 tables) | name, revenue | Units/AOV/turnover secondary cols; header row `flex-col sm:flex-row` line ~60 |

Ensure every table's outer wrapper is `overflow-x-auto rounded-lg border`
(add `overflow-x-auto` where missing). Add `whitespace-nowrap` to numeric
cells so they don't wrap mid-number.

**Commit 2:** `fix(admin): responsive data tables — hide low-priority columns on mobile`

---

## 5. HIGH — Admin forms (multi-column grids don't stack)

All admin grids are `grid-cols-N` with no mobile prefix → cramped/overflow.
Rule: lead with `grid-cols-1`, push the multi-col to `sm:`/`md:`.

- `components/admin/products/ProductForm.tsx`
  - line ~406 `grid grid-cols-2 gap-3` → `grid grid-cols-1 sm:grid-cols-2 gap-3`
  - line ~472 size row `grid-cols-[1fr_1fr_1fr_1fr_auto]` (5 cols, the worst
    offender) → `grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-[1fr_1fr_1fr_1fr_auto] items-end`.
    Make the remove/action button span full width on the 2-col mobile layout
    (`col-span-2 sm:col-span-1`).
- `components/admin/coupons/CouponForm.tsx`
  - lines ~86, ~135 `grid grid-cols-2 gap-3` → `grid grid-cols-1 sm:grid-cols-2 gap-3`
  - button row ~197 `flex gap-2` → `flex flex-col sm:flex-row gap-2` with
    buttons `w-full sm:w-auto`
- `app/(admin)/admin/settings/page.tsx`
  - lines ~220, ~412, ~436 `grid-cols-2` → `grid-cols-1 sm:grid-cols-2`
  - line ~260 `grid-cols-3` → `grid-cols-1 sm:grid-cols-3`
- `components/admin/products/ImageUpload.tsx` — thumbs `size-20` → `size-16 sm:size-20`,
  gap `gap-2` → `gap-1.5 sm:gap-2`. Upload button same `size-16 sm:size-20`.

**Commit 3:** `fix(admin): stack form grids on mobile (products, coupons, settings)`

---

## 6. HIGH — Admin dashboard + POS

- `app/(admin)/admin/page.tsx`
  - header (line ~128) `flex items-center justify-between` →
    `flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`; action
    buttons container `flex gap-2 flex-wrap`.
  - recent-orders row (~297) `flex items-center gap-4` →
    `flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4`.
- `components/admin/shared/StatCard.tsx` — value `text-3xl` → `text-2xl sm:text-3xl`.
- `components/admin/pos/POSScreen.tsx`
  - already `grid-cols-1 lg:grid-cols-[1fr_340px]` (ok). Tighten sidebar
    `p-5` → `p-4 sm:p-5`.
  - sale-item row (~245) `flex items-center gap-3` is tight at 360px; price
    `w-20` → `w-16 sm:w-20`, qty controls gap `gap-1 sm:gap-2`.
- `components/admin/notify/NotifyRequestRow.tsx` — row `flex items-center
  justify-between` → `flex flex-col gap-2 sm:flex-row sm:items-center
  sm:justify-between`; right group `ml-4 gap-4` → `ml-0 sm:ml-4 gap-2 sm:gap-4`.

**Commit 4:** `fix(admin): responsive dashboard header, POS rows, stat cards, notify rows`

---

## 7. MEDIUM — Storefront tightening

Storefront is mostly fine. Real fixes only:

- `components/store/checkout/CheckoutMethodSelector.tsx` (line ~62) — tabs
  `grid-cols-4`/`grid-cols-3` in one row overflow at 360px. →
  `tabCount === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'`.
  Add `text-xs sm:text-sm` to triggers.
- `components/store/checkout/ManualOrderForm.tsx` (lines ~94, ~105) — address
  `grid grid-cols-2` → `grid grid-cols-1 sm:grid-cols-2`.
- `components/store/product/ProductActions.tsx` (line ~69) — `grid grid-cols-2`
  → `grid grid-cols-1 sm:grid-cols-2` (stack Add-to-cart / WhatsApp on phone).
- `components/store/checkout/BankTransferInstructions.tsx` (line ~37) —
  `grid-cols-[auto_1fr]` → `grid-cols-1 sm:grid-cols-[auto_1fr]`.
- `components/store/product/ProductHero.tsx` (line ~72) — `gap-8 md:gap-12` →
  `gap-4 sm:gap-6 md:gap-12`.
- `components/store/checkout/OrderSummary.tsx` + `track/[orderId]/cancel`
  card — `p-5` → `p-4 sm:p-5`.

**Note — leave as-is (intentional):** storefront product grid in
`(store)/page.tsx` is `grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4`.
A 2-up product grid on phones is the correct ecommerce pattern — do **not**
change to `grid-cols-1`. (Optionally simplify the redundant `sm:grid-cols-2`.)

**Commit 5:** `fix(store): responsive checkout tabs, address grid, product actions`

---

## 8. LOW — PWA banners + shell safe areas

- `components/pwa/InstallPrompt.tsx` (~84) `p-4` → `p-3 sm:p-4`; inner row
  `flex items-center justify-between` → `flex flex-col gap-2 sm:flex-row
  sm:items-center sm:justify-between`; buttons `w-full sm:w-auto`.
- `components/pwa/OrderPushOptIn.tsx` (~24) same flex-col-on-mobile treatment;
  buttons `w-full sm:w-auto`.
- `components/store/shell/AppTabBar.tsx` (~46) — compose `safeArea.bottom` so
  tabs clear the home indicator: `cn(layout.tabBar, safeArea.bottom, ...)`.
- `components/store/shell/AppHeader.tsx` (~21) — compose `safeArea.x`.
- `components/store/StorefrontHeader.tsx` — logo `h-8 w-32` → `h-6 w-24 sm:h-8 sm:w-32`.

**Commit 6:** `fix(pwa): stack install/push banners on mobile, safe-area shell insets`

---

## 9. Acceptance

- No horizontal page scroll at 360px on any route in §2.
- Admin sidebar hidden on phone; hamburger opens drawer; links navigate + close.
- Every admin table either fits or scrolls inside its own box (body never scrolls X).
- All form grids single-column at 360px.
- `pnpm lint` + `pnpm typecheck` clean. (No string/type/style duplication —
  reuse `layout.*`, `safeArea.*`, `cn()`.)

## 10. Out of scope (v2)
Card-based mobile table layouts (replacing tables entirely), container queries,
landscape-specific tuning, responsive chart redesigns.

---

> Line numbers above are from the audit snapshot — verify against the live file
> before editing (a few drift by ±2). The className change is the contract.
