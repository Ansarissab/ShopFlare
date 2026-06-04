---
status: accepted
date: 2026-06-04
---
# ADR 0007: Full-Stack PWA Architecture (Phase 10)

## Context

Phase 9 left ShopFlare with a partial admin-only PWA: a static manifest (admin branding only) and a hand-written service worker (push + notificationclick only, no caching/offline). Missing icon assets meant install criteria silently failed. Customer-facing storefront had no offline support, no native UX, no install flow.

## Decision

Implement a comprehensive PWA covering both surfaces with five sub-decisions:

1. **Serwist (`@serwist/next`) over hand-rolled SW.** Serwist 9 integrates with the Next.js webpack build, generates a precache manifest from the asset graph, and provides Workbox-style runtime strategies. Force `--webpack` flag on `next build` (Turbopack does not yet support the Serwist webpack plugin, tracked upstream in serwist#54). The existing push + notificationclick handlers are ported verbatim into `src/sw.ts`.

2. **Dynamic manifests via Next.js route handlers.** Two `force-dynamic` edge routes (`/manifest.webmanifest`, `/admin-manifest.webmanifest`) serve manifests that reflect live merchant config (name, theme color, logo). Satisfies the Dynamic-First rule — branding changes take effect without redeploy. Fallbacks to bundled defaults when config is unavailable.

3. **Separate customer push subscription table.** Rather than mixing admin and customer push in one table, a dedicated `customer_push_subscriptions` table adds `order_number`, `kind` (order | restock), and `size_option_id` columns. Clean security boundary: admin subscriptions remain behind CF Access; customer subscriptions are on the public API (Turnstile-gated).

4. **Background Sync via Serwist `BackgroundSyncQueue` + IDB.** Offline form submissions (COD checkout, reviews, notify-me) are queued in IndexedDB and replayed when connectivity returns. The SW handles the `backgroundsync` event for the `offline-post-queue` tag.

5. **Standalone-aware native shell.** `useDisplayMode()` detects installed state (CSS media query + iOS `navigator.standalone`). In standalone mode: Bottom `AppTabBar`, compact `AppHeader`, safe-area insets, View Transitions, haptic feedback via `navigator.vibrate`.

## Supersedes

Extends ADR 0004 (PWA Web Push). Admin push behavior unchanged.

## Tradeoffs

- `--webpack` build flag means no Turbopack during CI/CD until Serwist adds Turbopack support. Webpack builds are slightly slower but produce identical output.
- Dynamic manifests make 1 extra worker fetch at page load (cached 5 min). Trade-off for correct branding.
- Customer push encryption uses plaintext JSON body over HTTPS (not RFC 8291 AES-GCM encrypted push). Acceptable for order-status notifications; no PII in the payload beyond order number.
