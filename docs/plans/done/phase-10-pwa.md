# Phase 10 — Full-Fledged Native-Feel PWA

> Target file when accepted: `docs/plans/proposed/phase-10-pwa.md`
> Standards baseline: PWA / Web Platform as of **June 2026** (iOS 26 home-screen-by-default, iOS 18.4+ Declarative Web Push + Screen Wake Lock, Badging API, View Transitions, Serwist 9 / `@serwist/next`).

## Context

ShopFlare today has only a **partial, admin-only PWA**: a static `public/manifest.json` titled "Store Admin" (`start_url: /admin`) and a hand-written `public/sw.js` that does **push + notificationclick only**. There is:
- No offline support, no precache, no app shell — closing the network kills the storefront.
- No install flow for customers (no `beforeinstallprompt` handling, no iOS A2HS guidance).
- No native-feel UX (no standalone detection, bottom nav, safe-area insets, page transitions, splash screens).
- **Missing icon assets** — the admin manifest references `/icon-192.png` and `/icon-512.png`, but `public/` contains none. The install criteria silently fail.
- The manifest is **static**, violating the project's Dynamic-First rule — it ignores merchant store name, colors, and logo.
- Push reaches the **merchant only**; customers get nothing.

**Goal:** turn the whole app (storefront + admin) into an installable, offline-capable PWA that behaves like a native mobile app, with customer push notifications, and a documented Google Play (TWA) packaging path. White-label and Dynamic-First must hold: branding/icons come from D1 store config, no redeploy.

**Decisions locked with user:** full scope (storefront + admin + customer push) · Serwist (`@serwist/next`) · include Play Store TWA · full native shell (bottom tabs, view transitions, safe areas, haptics).

## Success Criteria
- Lighthouse PWA / installability: pass on storefront and admin.
- Installable on Android (custom prompt) + iOS 16.4+/26 (A2HS guidance) + desktop.
- Storefront is browseable offline (cached shell + catalog + product images) with an offline fallback.
- Manifest + icons + theme color reflect live merchant config with **no redeploy**.
- Customer receives push on order status changes and back-in-stock; merchant push unchanged.
- In standalone mode the storefront shows an app shell: bottom tab bar, app header, safe-area insets, animated transitions.
- Offline-submitted COD orders / reviews / notify-me requests replay via Background Sync.
- Documented, reproducible TWA build for Google Play.

---

## Architecture Decisions

1. **Serwist replaces the hand-rolled SW.** Author a single SW source (`src/sw.ts`) compiled by `@serwist/next` to `public/sw.js` at build. The existing `push` + `notificationclick` handlers move **into** this source (no behaviour lost) alongside Workbox-style runtime caching + precache. One SW serves both route groups (scope `/`).
   - *Risk to verify first:* Cloudflare Pages build compatibility. Confirm the current Pages adapter (proxy.ts ⇒ functions, not static export) tolerates the Serwist webpack/turbopack injection and that the generated precache manifest references resolvable `_next/static/*` URLs. Spike this in Phase A step 0 before committing.

2. **Dynamic manifests via Next route handlers** (Dynamic-First). Two handlers on the **Pages origin** (same-origin install requirement):
   - `src/app/manifest.webmanifest/route.ts` → storefront manifest (`scope:/`, `start_url:/?source=pwa`, shortcuts: Track order, Cart, Shop).
   - `src/app/admin-manifest.webmanifest/route.ts` → admin manifest (`scope:/admin`, `start_url:/admin`).
   Both `force-dynamic`, fetch store config from the Worker (reuse the cached `/api/config/store`), and emit name/short_name/theme_color/background_color/icons from config. Fall back to bundled defaults. Each route group links its own manifest in its layout `<head>`.

3. **Icons from config + bundled fallbacks.** Generate a default icon set (192, 512, maskable 512, monochrome for badging, Apple touch + startup images) committed to `public/`. Manifest prefers merchant `logoUrl`/`appIconUrl` when set; otherwise uses defaults. This fixes the current missing-icon bug.

4. **Standalone-aware app shell.** A `useDisplayMode()` hook (`matchMedia('(display-mode: standalone)')` + iOS `navigator.standalone`) toggles between the existing web chrome (`StorefrontHeader`/`Footer`) and a native shell (compact app header + bottom `AppTabBar`). No duplicate pages — same routes, different chrome.

5. **DRY integration (enforced):** all copy → `src/lib/i18n/en.ts` (`pwa.*` namespace); cache names + tab route table + manifest defaults → `src/lib/constants/index.ts`; config additions via `.extend()` on the existing config schema in `src/lib/schemas/config.ts`; new types → `src/lib/types/`; **all** network via `src/lib/api.ts` (extend for Background Sync enqueue); repeated layout combos (safe-area, app-shell) → `src/lib/styles.ts`; SW registration in one provider, not buried in `usePushSubscription`.

---

## Phase A — Foundation: Serwist SW, dynamic manifest, installability, offline

**Step 0 — Spike:** add `@serwist/next`, wire a trivial SW, run `pnpm build` + `wrangler pages deploy` to confirm CF Pages compatibility. Gate the rest of the phase on this.

- **Deps:** `serwist`, `@serwist/next` (dev).
- **`next.config.ts`:** wrap export with `withSerwist({ swSrc: 'src/sw.ts', swDest: 'public/sw.js', ... })`. Keep existing CSP/headers. Disable SW in dev to avoid cache-hell (`disable: process.env.NODE_ENV !== 'production'`).
- **`src/sw.ts` (new):** Serwist instance with `precacheEntries: self.__SW_MANIFEST`; runtime strategies:
  - `_next/static/*`, fonts → **CacheFirst** (immutable, long expiry).
  - HTML navigations → **NetworkFirst** w/ `/offline` fallback.
  - Worker `GET /api/config/*`, `/api/products*` → **StaleWhileRevalidate** (browse offline).
  - Product images (`https:` remote / R2) → **CacheFirst** + `ExpirationPlugin` (cap count + age).
  - **Port existing `push` + `notificationclick` handlers verbatim** from `public/sw.js`.
- **`src/app/offline/page.tsx` (new):** branded offline fallback (uses theme vars + `en.pwa.offline`).
- **Dynamic manifest route handlers** (2, as above) + link tags in `src/app/(store)/layout.tsx` head and `src/app/(admin)/admin/layout.tsx` head (via Next `metadata`/manifest field where possible, else explicit `<link rel="manifest">`).
- **Icon/splash assets:** generate and commit to `public/` (icon-192/512, maskable, monochrome, `apple-touch-icon`, iOS `apple-touch-startup-image` set). Document regeneration (`pwa-asset-generator`) in `docs/features/`.
- **Viewport + Apple meta** in `src/app/layout.tsx`: `viewport-fit=cover`, `theme-color` (light/dark via media), `apple-mobile-web-app-capable`, `-status-bar-style`, `apple-touch-icon`, startup images.
- **SW registration:** new `src/components/pwa/ServiceWorkerProvider.tsx` (registers `/sw.js`, handles update lifecycle) mounted in root layout. Refactor `usePushSubscription` to **reuse** `navigator.serviceWorker.ready` rather than calling `register()` itself.
- **Update flow:** on `waiting` SW → `sonner` toast "Update available → Reload" (`en.pwa.updateAvailable`); on confirm `skipWaiting()` + reload.
- **Old file:** delete `public/manifest.json` and the hand-written `public/sw.js` (now generated). *(Will request explicit permission before deleting — per workspace rules.)*

## Phase B — Native shell UX (full)

- **`useDisplayMode()` hook** (`src/hooks/`) — standalone/browser/fullscreen detection (SSR-safe, mirrors `usePushSubscription` deferred-detection pattern).
- **`AppTabBar`** (`src/components/store/shell/`): fixed bottom nav, safe-area padding, shown in standalone (and optionally mobile web). Tabs: Home, Shop/Search, Cart (live count from `useCartItemCount`), Track, Menu. Strings in `en.pwa.tabs.*`, routes in a `TAB_ROUTES` constant.
- **`AppHeader`** (compact, standalone-only) replacing `StorefrontHeader` when installed; `StoreLayout` switches chrome via `useDisplayMode()`.
- **Safe-area insets:** add `env(safe-area-inset-*)` utilities to `src/lib/styles.ts` + `globals.css`; apply to header, tab bar, sheets (`CartSheet`), checkout.
- **View Transitions:** enable cross-page transitions (Next 16 `ViewTransition` / CSS `@view-transition`) for native slide/shared-element feel (product card → product hero). Respect `prefers-reduced-motion`.
- **Haptics:** small `vibrate()` helper in `src/lib/utils/` for add-to-cart / tab switch (Android; no-op iOS).
- **Touch polish (`globals.css`):** remove tap highlight, `overscroll-behavior`, momentum scroll, larger tap targets, disable UI-chrome text selection.
- **`InstallPrompt`** (`src/components/pwa/`): capture `beforeinstallprompt` (Android/desktop) → custom banner/button; iOS → manual A2HS instructions sheet. Dismissal persisted in localStorage. Copy in `en.pwa.install.*`.

## Phase C — Customer push, Background Sync, Badging

- **DB migration** (`worker/db/migrations/`): extend push subscriptions to support customer subscriptions keyed to an order/customer (add `kind` = `admin|customer` + nullable `order_id`/contact), or a new `customer_push_subscriptions` table. Update `worker/db/schema.ts` (source of types).
- **Worker routes:** public `POST /api/push/subscribe` (customer, tied to order; Turnstile-gated like other public forms). Reuse `worker/lib/push.ts` send logic. Trigger customer push from the existing order-status-change path (`worker/lib/notify.ts` / `worker/routes/admin/orders.ts`) alongside current email — sends "Order shipped / delivered". Add push option to back-in-stock **Notify Me** flow (`worker/routes/notify.ts`).
- **Schemas:** extend push schema in `src/lib/schemas/push.ts` for customer subscribe payload.
- **Client opt-in:** prompt customers to enable order notifications on checkout success + order tracking page (reuse `usePushSubscription`, generalized for customer vs admin endpoint). Strings in `en.pwa.notifications.*`.
- **Badging API:** `navigator.setAppBadge()` for unread order updates; clear on tracking-page view.
- **Declarative Web Push:** support iOS 18.4+ declarative payload shape in `src/sw.ts` push handler (graceful fallback to imperative).
- **Background Sync:** Serwist `BackgroundSyncQueue` for offline POSTs (COD checkout, review submit, notify-me). Extend `src/lib/api.ts` `apiPost` to detect offline and enqueue → replay on reconnect; toast on success/failure (`en.pwa.sync.*`).
- **Offline indicator:** online/offline banner component driven by `navigator.onLine` + events.

## Phase D — Google Play packaging (TWA)

- **`public/.well-known/assetlinks.json`:** Digital Asset Links for domain verification (SHA-256 of signing key).
- **Bubblewrap / PWABuilder config** committed under `packaging/twa/` (manifest URL, app id, colors from defaults).
- **Docs:** `docs/features/pwa-app-store.md` — generate TWA with Bubblewrap, sign, upload to Play Console; note iOS distribution stays A2HS / optional PWABuilder iOS wrapper.
- No app-level code changes beyond assetlinks + ensuring manifest meets TWA criteria (maskable icon, `id`, etc.).

## Phase E — Update flow hardening, perf, QA

- **Perf for native feel (INP/LCP):** route prefetch on tab/links, `priority` on product hero image, confirm font-display swap (already set), audit bundle. Keep existing no-flash theme boot.
- **CSP review:** confirm `connect-src` covers worker push origin (already allow-listed); `manifest`/`worker-src` via `default-src 'self'` (same-origin SW + manifest). No new external origins.
- **Cross-device QA matrix:** Android Chrome (install, push, badge, bg-sync), iOS 16.4+/26 Safari (A2HS, push, standalone, splash, safe-area), desktop. Document in feature doc.
- **Docs/ADR:** update `docs/features/pwa-notifications.md`; supersede/extend `docs/adr/0004` with an ADR for the Serwist + dynamic-manifest + customer-push architecture.

---

## Critical Files

**New**
- `src/sw.ts` — Serwist SW source (caching + ported push handlers)
- `src/app/manifest.webmanifest/route.ts`, `src/app/admin-manifest.webmanifest/route.ts` — dynamic manifests
- `src/app/offline/page.tsx` — offline fallback
- `src/hooks/useDisplayMode.ts`
- `src/components/pwa/ServiceWorkerProvider.tsx`, `InstallPrompt.tsx`, `OfflineBanner.tsx`
- `src/components/store/shell/AppTabBar.tsx`, `AppHeader.tsx`
- `public/` icon + splash assets, `public/.well-known/assetlinks.json`
- `worker/db/migrations/000X_customer_push.sql`
- `docs/features/pwa-app-store.md`, new ADR

**Modified**
- `next.config.ts` — `withSerwist(...)`, keep CSP/headers
- `src/app/layout.tsx` — viewport-fit, theme-color, Apple meta, mount `ServiceWorkerProvider`
- `src/app/(store)/layout.tsx`, `src/app/(admin)/admin/layout.tsx` — manifest links, standalone chrome switch
- `src/app/globals.css`, `src/lib/styles.ts` — safe-area + touch polish utilities
- `src/lib/i18n/en.ts` — `pwa.*` strings
- `src/lib/constants/index.ts` — cache names, `TAB_ROUTES`, manifest defaults
- `src/lib/schemas/config.ts`, `src/lib/schemas/push.ts` — `.extend()` config + customer push
- `src/lib/api.ts` — Background Sync enqueue
- `src/hooks/usePushSubscription.ts` — generalize admin vs customer; reuse SW registration
- `worker/db/schema.ts`, `worker/lib/push.ts`, `worker/lib/notify.ts`, `worker/routes/push.ts`, `worker/routes/notify.ts`, `worker/routes/admin/orders.ts` — customer push wiring
- **Delete (with permission):** `public/manifest.json`, `public/sw.js`

## Verification

- `pnpm build` succeeds with Serwist; `public/sw.js` generated with precache manifest. **Phase A step 0 must confirm this builds + deploys on CF Pages before proceeding.**
- `pnpm typecheck`, `pnpm lint`, `pnpm test` green; add tests for manifest route handler + customer push schema/route (extend `worker/test/api.integration.test.ts`).
- Local run (`pnpm dev:all`) → DevTools Application panel: manifest valid, SW active, install prompt fires; throttle to Offline → storefront shell + offline page render.
- Lighthouse PWA audit pass (storefront + admin).
- Manual push: place order → customer + merchant receive push; toggle stock → back-in-stock push; badge updates.
- Background Sync: submit COD order offline → queued → replays online (verify D1 row).
- iOS device: A2HS → standalone shell, splash, safe-area, push (16.4+).
- TWA: Bubblewrap build installs, domain verified via assetlinks, launches without browser chrome.

## Risks / Notes
- **CF Pages + Serwist** is the top risk → spike first (Phase A step 0).
- iOS push requires installed (home-screen) PWA + user gesture; EU/non-EU and version caveats apply — guidance copy must set expectations.
- Deleting generated-replaced files needs explicit user OK (workspace rule).
- Suggest landing as ordered sub-PRs (A→E); each phase is independently shippable. Small focused commits per project convention. No push/PR by me.
