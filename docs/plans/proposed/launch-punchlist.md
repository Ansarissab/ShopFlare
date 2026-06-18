# Launch Punch-list

Status: In progress. Opened 2026-06-17, after the production SSR 404 incident was fixed
(commits `50540f9` fetchFromWorker no-store+log, `c1a6f4b` `global_fetch_strictly_public`).

Consolidates the two tracks that were outstanding when the prod fire jumped the queue:
**(A) the docs/README polish track** (the heygen demo video + glossary) and
**(B) production go-live verification**. Ordered quickest/easiest → hardest so we can
knock out wins first.

Conventions: small focused commits in conventional-commit style (no AI attribution).
**Never deploy to prod without the user's explicit per-action go-ahead** (see memory
`feedback-no-redeploy-without-permission`). Run cheap gates (tsgo + lint + targeted unit)
at the end of an edit batch; hand the heavy `pnpm verify` to the user.

Legend: ⏱ effort · 🚀 needs a prod deploy · 🔑 needs secrets/config the user controls · 👤 user-owned

---

## Tier 1 — Quick wins (minutes, no deploy, no secrets) — ✅ DONE

- [x] **1. Retire the stray plan doc.** Moved `repo-hygiene-remove-graphify-out.md`
  proposed→done (graphify-out already removed in `88f8d19`).
- [x] **2. CONTEXT.md glossary — multi-landing templates.** Added the **Landing Template**
  entry (`LANDING_TEMPLATE_REGISTRY` + shared `templateKit`) and fixed the stale **Style
  Preset** "v2 concept" note.
- [x] **3. ADMIN_DEV_BYPASS dev login bypass.** Added `isAdminDevBypass()` in `src/lib/api.ts`
  (single source; dev + `NEXT_PUBLIC_ADMIN_DEV_BYPASS=1`, inert in prod builds); `AdminShell`
  skips the login redirect when on. Mirrors the backend two-condition guard in
  `worker/lib/access.ts`. +5 unit tests. Activate with `NEXT_PUBLIC_ADMIN_DEV_BYPASS=1` in
  `.env.local` (plus the worker side: `ENVIRONMENT=development` + `ADMIN_DEV_BYPASS=1`).

## 🔴 URGENT (found during the Tier-2 sweep) — Stripe secret key leaked publicly

- [ ] **0. `STRIPE_PUBLISHABLE_KEY` in prod holds a SECRET key.** `/api/public-config` was
  serving an `sk_test_…` value (a Stripe **secret** key) under `stripePublishableKey` —
  publishable keys start with `pk_`. The code reads the right env var; the stored value is
  wrong. **User actions (I can't — secrets + deploy):**
  1. **Rotate** the exposed `sk_test_…` key in the Stripe dashboard (it's been public).
  2. Set `STRIPE_PUBLISHABLE_KEY` to the actual **publishable** key (`pk_test_…` / `pk_live_…`)
     in `.prod.vars`, then `pnpm secrets:prod`. (Stripe.js on the client needs `pk_` anyway —
     checkout would fail with a secret key.)
  3. Redeploy the API worker.
  - ✅ Code guardrail added (commit below): `/api/public-config` now refuses to emit any
    `sk_`/`rk_` value (blanks it + logs) so a **live** secret can never leak the same way.
    Takes effect on the next API-worker deploy.

## Tier 2 — Quick prod checks (curl-only, no deploy) — ✅ DONE

- [x] **4. Images.** Demo products render images via the seed's external `picsum.photos` URLs,
  so images display. `/cdn/<r2Key>` for demo keys 404s (the seed inserts keys but uploads no
  real R2 objects) — that's expected; the `/cdn` path is exercised on real admin uploads, not
  the demo seed.
- [x] **5. Public surface sweep — green.** 200 on `/shop`, `/policy/privacy`, `/sitemap.xml`,
  `/blog/rss.xml`, both manifests, `/robots.txt`, `/healthz`. Non-issues confirmed: `/cart` 404
  is by design (cart is a drawer, no route), `/api/config` bare 404 is by design (app uses
  `/api/config/store`). **One thing to eyeball in a browser:** `/shop`'s catalog is
  client-rendered (`StorePageClient`), so it shows products via the client API — confirm it
  populates visually (raw HTML has no SSR product links, which is normal here).

## Tier 3 — Prod feature verification (needs secrets/config; some user-owned)

Curl-verified so far (no secrets needed):

- ✅ **Admin API fails closed.** `/api/admin/{config,orders,products}` all return **401**
  without a token — `requireAdmin` works in prod.
- ✅ **Admin login is Turnstile-gated + validates.** `POST /api/admin/login` with no
  Turnstile token → **400 "Verification failed"** (the prod-only Turnstile enforcement is on).
- ✅ **Turnstile site key configured** — `/api/public-config` returns a real `0x4AAAAAA…` key.

Still needs you (secrets / browser):

- [ ] **6. Admin login full flow.** 🔑 Confirm `ADMIN_PASSWORD` + `ADMIN_SESSION_SECRET` are set
  on the API worker; log in via the browser (solves Turnstile) and confirm the Bearer-token
  flow works cross-origin (web ↔ api on separate `*.workers.dev` hosts). ⏱ 10 min
- [ ] **7. Turnstile end-to-end.** 🔑 Site key is present; do a real browser submit (admin login
  or contact form) and confirm the challenge passes (i.e. the Turnstile *secret* on the API
  worker matches the site key). ⏱ 10 min
- [ ] **8. Order emails (Resend) in prod.** 🔑 Confirm the Resend key + from/BCC config; place a
  test COD order, confirm the merchant + customer emails arrive. ⏱ 15 min
- [ ] **9. Stripe checkout end-to-end in prod.** 🔑 **Blocked until the `pk_` key is set** (item
  0 — currently `STRIPE_PUBLISHABLE_KEY` holds an `sk_test_` secret; the new guardrail will
  blank it, so Stripe.js won't init). After setting `pk_test_…`: run one test-mode checkout →
  order created → webhook (signature-verified) marks it paid → email fires. ⏱ 30–45 min

## Tier 4 — Bigger deliverables

- [ ] **10. Phase 33 — mobile PageSpeed 79 → 95+ (LCP is the sole blocker).** After-deploy
  mobile report: Perf **79**, and the *only* red metric is **LCP 5.6s** (FCP 0.9s, TBT 10ms,
  CLS 0, SI 2.0s; A11y/BP/SEO all 100). The LCP element is the hero **product image**. Concrete
  opportunities from the Lighthouse PDF (`tmp/mobile-after-deploy-v1-…pdf`):
  1. **Preload the LCP image** (`<link rel="preload" fetchpriority="high">`) — it has
     `fetchpriority=high` but isn't preloaded, so it's discovered late. (~680ms)
  2. **Eliminate render-blocking CSS** — two chunks, ~22 KiB, block initial render. (~680ms)
  3. **Right-size images** — 800×800 served into a 389px box (~136 KiB). Demo uses external
     `picsum.photos` (no responsive variants); real stores use the R2/AVIF pipeline — add
     `sizes`/responsive widths + ensure the image loader requests display-sized images.
  4. **Reduce unused JS** — ~25 KiB in one chunk.
  See `docs/plans/proposed/phase-33-final-page-speed-gate.md`. **Note:** the demo's picsum
  images cap the ceiling; verify the win on an R2-backed image too. ⏱ ~half-day
- [ ] **11. README demo video.** 👤 Generate a Shop + Admin walkthrough on the seed data via
  heygen (`heygen-com/hyperframes`), host it externally (YouTube / CDN / GitHub Release — not
  committed), then swap `REPLACE_WITH_HOSTED_VIDEO_URL` at `README.md:29`. The `## Demo`
  section + badge are in place. **$0 fallback:** capture it as a **Playwright GIF** instead. ⏱ video: hours / GIF: ~1h
- [ ] **12. Run the heavy gate.** 👤 `pnpm verify` (build + integration + smoke + e2e) once —
  lots changed (fetch helper, schemas, worker routes, wrangler). User-run per project rule.

## Tier 5 — Deferred enhancements (not blocking launch)

- [ ] **13. Quiet test-suite output (CLI/TUI wrapper).** Wrap the test runner so a normal run
  shows only **failures + the final summary** (not the full per-file firehose), with a
  `--verbose` flag to show everything. Likely a custom Vitest reporter (cleanest — `onFinished`
  prints a compact summary; only failed tasks expanded) over wrapping with a TUI package; gate
  verbose behind an env/flag. Apply to `test`/`test:unit`/`verify` output. ⏱ ~2h
- [ ] **14. Re-enable ISR / data cache.** Wire an `incrementalCache` (R2 or KV) in
  `open-next.config.ts`, then restore the `next: { revalidate }` option in `fetchFromWorker`
  (currently every store page is `no-store` dynamic — correct + safe, just not cached). ⏱ ~1h
- [ ] **15. Strip demo coupons from the seed for real stores.** `WELCOME10` / `FLAT500` are
  active with no expiry — fine for the demo, remove (or gate behind a demo flag) before a real
  merchant goes live. ⏱ 10 min

---

## Done (this incident + the docs track, for reference)

- README refresh + positioning + corrected stats (`f29d0bd`); ADR 0018 (edge-safe sanitize) +
  ADR 0019 (multi-landing templates); dry-conventions templateKit/registry note.
- Security audit MEDs: Stripe error leak, imageR2Key prefix, atomic activate, bodyHtml cap (`771a0db`).
- Dev/prod env isolation preflight + worker-origin empty-URL guard (`dda94f0`).
- Prod SSR 404 fix: `fetchFromWorker` no-store + loud logging (`50540f9`); same-zone
  `global_fetch_strictly_public` flag (`c1a6f4b`). Verified live.
