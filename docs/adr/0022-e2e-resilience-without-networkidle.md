# ADR 0022 — E2E resilience without `networkidle` + store-config fetch dedupe

Status: accepted · Date: 2026-06-19

## What broke

After the loading-state refactor (`DeferredChrome` → directly-mounted chrome:
`AppHeader`, `AppTabBar`, `WhatsAppWidget`, `OfflineBanner`, `InstallPrompt`, and
a non-lazy `CartSheet`), ~20 e2e tests started timing out under `pnpm verify`
(3 workers).

Two root causes:

1. **Config fetch storm.** Each chrome component calls `useStoreConfig`, which had
   its **own** `useState`+`apiGet` — no shared cache. So every store page fired
   5+ identical `GET /api/config/store` requests (plus 4× `/api/categories`),
   ×3 workers, against the single local miniflare D1. The network never went quiet
   for the 500 ms `networkidle` needs → `waitForLoadState('networkidle')` timed out.
2. **Hydration races.** A client component's markup is server-rendered, so its
   element is visible/clickable **before** its `onClick`/`onSubmit`/keydown handler
   is wired. A click/keypress/fill fired in that window is silently dropped (forms
   never submit, dialogs never open, filled inputs reset on hydration).

Secondary, all transient under load: axe scanning mid-redirect ("execution context
destroyed"), and SSR worker-fetch drops surfacing as console errors / incomplete
SSR HTML.

## How we solved it

**App (root cause of the storm):**
- `dedupedGet` in `useApiResource` — concurrent identical GETs share one in-flight
  request (cleared on settle, so never stale).
- `useStoreConfig` now wraps `useApiResource` (SWR cache) → config fetched **once
  per session**, served from cache on every later navigation, background-revalidated,
  and still refetched on focus / admin-edit broadcast. Categories already rode that
  cache, so they collapsed to one request too.

**E2E (off the fragile primitive):**
- Removed all 54 `networkidle` waits → `gotoReady` (navigate, then assert on the
  real element via auto-waiting web-first assertions).
- `actUntil(action, expectation)` — retries hydration-sensitive interactions until
  the handler is wired (guarded/idempotent so retries are harmless).
- `escapeUntilHidden` — symmetric retry for dialog close.
- a11y scan retried (`toPass`) so it runs against the final, post-redirect DOM.
- Smoke targets the page heading **by name**, not `.first()` (chrome can paint an
  empty leading heading first).
- Transient dev-backend noise filtered in the `consoleErrors` fixture
  (`ERR_*` / `fetch failed` / `[fetchFromWorker]` / Suspense "switched to client
  rendering"); the SSR-metadata test re-fetches until the HTML is complete.

## Why it won't happen again

- `networkidle` is gone from the suite — tests wait for **what they assert**, not
  for the whole network to fall silent, so adding more background fetches can't
  reintroduce these timeouts. (Playwright officially discourages `networkidle`.)
- Every shared client read now flows through `useApiResource`'s cache + in-flight
  dedup, so a new multi-consumer fetch path can't recreate a request storm.
- Hydration-race interactions use `actUntil`/`escapeUntilHidden`, which are immune
  to "clicked before the handler attached".
- Side benefit: fewer waits + fewer requests → the suite runs **faster**.

## If it regresses

- **Timeout on navigation:** never reach for `networkidle`. Use `gotoReady` + a
  web-first assertion on the target element. If a click/keypress/fill is dropped,
  wrap it in `actUntil` (guard the action on the post-state so retries are no-ops).
- **Dialog won't close:** `escapeUntilHidden(page, panel)`.
- **Console-error failure that's a transient backend drop:** confirm it passes in
  isolation, then add the pattern to the `consoleErrors` filter in `e2e/fixtures.ts`.
- **Duplicate network calls in the browser Network tab:** route the hook through
  `useApiResource` (don't hand-roll `useState`+`apiGet`); `dedupedGet` + `_cache`
  handle coalescing and reuse.

## Known noise (not a failure)

Integration logs spam `A header value for "MF-Vitest-Source" contains non-ASCII
characters …`. Cause: `@cloudflare/vitest-pool-workers` puts the test title in that
header, and many titles contain `—`/`→`. Harmless (tests pass); fix later by either
ASCII-only titles or filtering the line in `scripts/ci.mjs`.
