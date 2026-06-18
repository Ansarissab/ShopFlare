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

## Tier 2 — Quick prod checks (curl-only, no deploy)

- [ ] **4. Images serve from R2 in prod.** Curl a real `/cdn/<r2Key>` (e.g. a seeded product
  image key) on the API worker; confirm 200 + correct content-type, and that product pages
  render their images. ⏱ 5 min
- [ ] **5. Public surface sweep.** Curl the remaining public routes in prod (`/shop`, a policy
  page, `/sitemap.xml`, `/blog/rss.xml`, both manifests, `/healthz`) — confirm none regressed
  to not-found now that SSR data fetches work. ⏱ 10 min

## Tier 3 — Prod feature verification (needs secrets/config; some user-owned)

- [ ] **6. Admin login in prod.** 🔑 Confirm `ADMIN_PASSWORD` + `ADMIN_SESSION_SECRET` are set
  on the API worker (`.prod.vars` / `secrets:prod`); log in, confirm the Bearer-token flow
  works cross-origin (web ↔ api on separate `*.workers.dev` hosts). ⏱ 15 min
- [ ] **7. Turnstile on prod forms.** 🔑 You hit this earlier — confirm
  `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (build) + the Turnstile secret (API worker) are the prod
  pair; verify a public form (contact / admin login) passes the challenge in prod. ⏱ 15 min
- [ ] **8. Order emails (Resend) in prod.** 🔑 Confirm the Resend key + from/BCC config; place
  a test COD order, confirm the merchant + customer emails arrive. ⏱ 15 min
- [ ] **9. Stripe checkout end-to-end in prod.** 🔑 Hardest. Live keys set, webhook endpoint
  registered + signature verifying; run one real test-mode checkout → order created → webhook
  marks it paid → email fires. ⏱ 30–45 min

## Tier 4 — Bigger deliverables / your call

- [ ] **10. README demo video.** 👤 Generate a Shop + Admin walkthrough on the seed data via
  heygen (`heygen-com/hyperframes`), host it externally (YouTube / CDN / GitHub Release — not
  committed), then swap `REPLACE_WITH_HOSTED_VIDEO_URL` at `README.md:29`. The `## Demo`
  section + badge are already in place.
  - **$0 fallback:** I can capture the walkthrough as a **Playwright GIF** against the seed
    data instead — no external tool; host as a Release asset or gitignore it. ⏱ video: hours / GIF: ~1h
- [ ] **11. Run the heavy gate.** 👤 `pnpm verify` (build + integration + smoke + e2e) once —
  lots changed (fetch helper, schemas, worker routes, wrangler). User-run per project rule.

## Tier 5 — Deferred enhancements (not blocking launch)

- [ ] **12. Re-enable ISR / data cache.** Wire an `incrementalCache` (R2 or KV) in
  `open-next.config.ts`, then restore the `next: { revalidate }` option in `fetchFromWorker`
  (currently every store page is `no-store` dynamic — correct + safe, just not cached). ⏱ ~1h
- [ ] **13. Strip demo coupons from the seed for real stores.** `WELCOME10` / `FLAT500` are
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
