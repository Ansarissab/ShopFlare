# Phase 26 — Frictionless Setup (auto-provision + GitHub→CF deploy, disabled)

Covers backlog **#10** (frictionless automatic Cloudflare setup) and **#12**
(GitHub→Cloudflare deploy, implemented but kept DISABLED). PLAN doc only — no
app code lands in this file.

## 1. Goal

A non-developer merchant should be able to **fork → `pnpm setup` → live store**
with no manual id-pasting and no manual Stripe webhook step. Specifically:

- Wrangler **auto-provisions** D1/KV/R2 on the forker's account (no copy-paste of
  ids, no dashboard clicking) by listing bindings *without* hardcoded ids.
- The wizard creates the **Stripe webhook endpoint automatically** and stores
  `STRIPE_WEBHOOK_SECRET` — closing today's only "you must finish in the
  dashboard" gap that actually blocks payments.
- The wizard's end-of-run text reflects the **two-workers + Bearer** reality
  (no Pages, no CF Access — see [ADR 0009](../../adr/0009-opennext-ssr-worker-not-static-pages.md)
  and [ADR 0010](../../adr/0010-app-level-admin-auth-not-cf-access.md)).
- A **GitHub Actions deploy pipeline** exists for both workers but stays
  **disabled** until the merchant chooses to switch off CLI deploys.
- The **maintainer's own deploy keeps working** against the existing real
  resources — auto-provision must not orphan or duplicate them.

Non-goal restated up front: this is *fork-and-self-host* frictionless, not a
hosted multi-tenant onboarding service. See [§8](#8-non-goals).

## 2. Current state (verified)

### 2.1 Wizard — `scripts/setup/index.mts`
- Prereq check: Node 22+ and `npx wrangler --version` (`~:136-146`).
- `wrangler login` flow (`~:148-162`).
- Provisions resources by **shelling `wrangler d1 create` / `kv namespace create`
  / `r2 bucket create`**, parses the id out of stdout with `extractId()`, then
  `patchToml()` rewrites a `PLACEHOLDER` string in `wrangler.toml` (`~:164-208`).
- Migrate + seed remote D1 via `pnpm db:migrate` / `pnpm db:seed` (`~:210-220`).
- Prompts the 8 `SECRETS[]` incl. `STRIPE_*`, `RESEND_API_KEY`, `VAPID_*`,
  `TURNSTILE_*`, plus `FRONTEND_URL`, each via `wrangler secret put`
  (`~:115-124`, `~:222-261`).
- `pnpm worker:deploy` then regex-parses the `*.workers.dev` URL (`~:263-289`).
- Writes `.env.local` (`~:291-304`).

**Three live defects to fix:**
1. **Stale names.** The wizard creates `store-db` / `STORE_KV` / `store-images`
   (`~:171-203`), but the real bindings are `shopflare-db0` / `KV` /
   `shopflare-images0` (`wrangler.toml`, and `package.json` `db:migrate` targets
   `shopflare-db0`). The wizard's created resources don't match what deploy/migrate
   use → broken on a fresh fork today.
2. **Dead `patchToml()` path.** `patchToml()` looks for
   `PLACEHOLDER = "placeholder-replace-after-cf-setup"` (`~:35`, `~:93-102`) which
   **does not exist** in the current `wrangler.toml` (it has hardcoded ids). So id
   write-back silently no-ops (`log.warn`, `~:98`).
3. **Stale final note (`~:306-317`).** Tells the user to connect **Cloudflare
   Pages** (`build: pnpm build, output: out`) and set up **CF Access** +
   `CF_ACCESS_AUD` / `CF_ACCESS_TEAM_DOMAIN`. Both contradict ADR 0009/0010. Also
   the header docstring (`~:8`) repeats the Pages/Access/webhook framing.

### 2.2 Config with hardcoded ids
- `wrangler.toml`: `name = "shopflare-worker"`, `main = worker/index.ts`;
  `[[d1_databases]]` `binding=DB`, `database_name=shopflare-db0`,
  **`database_id = "f7a387f1-…"` (hardcoded)**, `migrations_dir=worker/db/migrations`;
  `[[kv_namespaces]]` `binding=KV`, **`id = "e0364e78…"` (hardcoded)**;
  `[[r2_buckets]]` `binding=R2`, `bucket_name=shopflare-images0`.
- `wrangler.frontend.jsonc`: `name=shopflare-web`, `main=.open-next/worker.js`,
  `ASSETS` binding (no D1/KV/R2 — frontend talks to the API worker over HTTP).

These ids are the **maintainer's real account resources**. A forker who runs
`wrangler deploy` with them in place will fail (the ids aren't on their account).

### 2.3 Scripts — `package.json`
- `setup` → `node scripts/setup/index.mts`.
- `worker:deploy` → `wrangler deploy --var ENVIRONMENT:production`.
- `web:deploy` → `opennextjs-cloudflare build && opennextjs-cloudflare deploy -c wrangler.frontend.jsonc`.
- `db:migrate` → `wrangler d1 migrations apply shopflare-db0 --remote`;
  `db:seed` → executes `worker/db/seed.sql --remote`; `:local` variants exist.
- `db:generate` → `drizzle-kit generate`.

### 2.4 Migrations / DB
- `drizzle.config.ts`: schema `worker/db/schema.ts`, out `worker/db/migrations`,
  `d1-http` driver, reads `CLOUDFLARE_ACCOUNT_ID` / `D1_DATABASE_ID` / `D1_TOKEN`.
- Migrations `0000_neat_maddog` … `0005_categories` present (+ `meta/`).

### 2.5 Webhook gap (manual today)
Stripe webhook + `STRIPE_WEBHOOK_SECRET` is a printed manual step
(`~:118` marks the secret `required: false`, `~:312` tells the user to add it in
the dashboard). Payments don't work until done by hand.

### 2.6 Health + CI
- `/api/ping` returns `{ ok: true }` (`worker/index.ts:34`) — usable post-deploy
  smoke check.
- Existing `.github/workflows/ci.yml` (typecheck→lint→test→build). The new deploy
  workflow is **separate** and must not touch `ci.yml`.

### 2.7 Docs (partly stale)
- `docs/setup/cloudflare-guide.md`, `docs/setup/quickstart.md` — manual steps,
  still reference Pages / CF Access in places. Other setup docs exist
  (`stripe-setup.md`, `resend-setup.md`, `domain-setup.md`,
  `environment-variables.md`).

## 3. Deliverables

### (a) Strip hardcoded ids → rely on Wrangler auto-provisioning

**Decision/rationale.** Wrangler **auto-provisions** D1/KV/R2 when a binding is
declared **without an id** (open beta, `wrangler@4.45.0+`, Oct 2025): `wrangler
deploy` creates the resource on the account via API, links it, and writes the id
back, staying linked across subsequent deploys. (`--no-x-provision` disables it.)
This removes the entire create→parse→patch dance for forkers.

- Edit `wrangler.toml`: **remove** `database_id` and the KV `id` lines, keep
  `database_name = "shopflare-db0"`, `binding`s, `bucket_name`,
  `migrations_dir`. Add a comment that ids are auto-provisioned on first deploy
  (link this plan + ADRs).
- `r2_buckets` already has no id → leave as is.
- `wrangler.frontend.jsonc` has no resource ids → unchanged (only revisit if the
  frontend ever gains a binding).

**Preserve the maintainer's existing resources** (the ids being removed point at
real data). Pick ONE, document it in `cloudflare-guide.md`:
- **Preferred — re-link, no committed ids.** On the maintainer's machine, the
  first post-strip `wrangler deploy` will try to *create* new resources. To keep
  the existing ones instead, the maintainer either (i) keeps a **git-ignored
  local override** (e.g. `wrangler.local.toml` / a `WRANGLER_CONFIG` pointing at a
  copy that still carries the real ids) used only for their own deploys, or
  (ii) re-links once via the dashboard/`wrangler` so the auto-provision metadata
  resolves to the existing `shopflare-db0` / KV / `shopflare-images0` rather than
  new ones (resources are matched by name where supported).
- The committed `wrangler.toml` is the **forker template** (ids stripped).
- Add the override filename to `.gitignore` if option (i) is chosen. **Never
  commit the real ids back.**
- Acceptance for this item lives in [§7](#7-acceptance): maintainer deploy still
  hits the original data; a clean fork auto-creates fresh resources.

### (b) Wizard rewrite — `scripts/setup/index.mts`

1. **Replace manual create + `patchToml`** with auto-provision. The wizard no
   longer runs `wrangler d1/kv/r2 create` or rewrites ids; the
   `wrangler deploy` step (already present, `~:263-289`) provisions on first
   deploy. Delete `extractId()`, `patchToml()`, `PLACEHOLDER`, and the
   provision block (`~:80-102`, `~:164-208`).
   - **Fallback for old wrangler:** detect wrangler version; if
     `< 4.45.0`, fall back to the legacy create-and-link path (kept behind a
     guard) and instruct upgrading. Prefer a one-line version note over keeping
     the whole dead path if it bloats the file — DRY.
2. **Fix stale resource names** wherever they survive (migrate/seed already use
   `shopflare-db0` via `pnpm db:*`, so dropping the create block also drops the
   `store-*` mismatch).
3. **Automated Stripe webhook creation (new step).** After the worker URL is
   known and `STRIPE_SECRET_KEY` is collected:
   - `POST https://api.stripe.com/v1/webhook_endpoints` with
     `url=<apiWorkerUrl>/api/stripe/webhook` and the events ShopFlare consumes
     (enumerate from the existing webhook handler in `worker/lib/stripe.ts` —
     do not invent events).
   - The CREATE response returns the signing secret (`whsec_…`); capture it and
     `wrangler secret put STRIPE_WEBHOOK_SECRET`.
   - Idempotency: if an endpoint for that URL already exists, reuse/skip rather
     than duplicate (the secret is only readable at create time, so warn + offer
     re-create if the user lacks it).
   - Gate behind a confirm; on failure, fall back to the existing manual
     instruction (don't hard-fail the wizard). Use Node's built-in `fetch`.
   - Flip `STRIPE_WEBHOOK_SECRET` out of the interactive `SECRETS[]` prompt
     (`~:118`) since it's now auto-derived; keep a manual override path.
4. **Fix the end-of-run note + docstring** (`~:8`, `~:306-317`): replace
   Pages/CF-Access/`CF_ACCESS_*` text with the two-workers + Bearer flow —
   `web:deploy` for the frontend, cross-worker `NEXT_PUBLIC_WORKER_URL` wiring,
   admin via `Authorization: Bearer` (set `ADMIN_PASSWORD` +
   `ADMIN_SESSION_SECRET`), and the remaining genuinely-manual steps
   (budget alerts, custom domain — see [(e)](#e-keep-budget-alerts--custom-domain-as-printed-manual-steps)).
5. **Frontend deploy + cross-worker wiring.** After the API worker URL is known,
   write it to `.env.local` as `NEXT_PUBLIC_WORKER_URL` (already happens) and
   prompt to run `pnpm web:deploy` so the frontend worker goes live too. The
   wizard is the real install path because it handles **both** workers; the
   button in (c) does not.
6. **Post-deploy smoke check (new step).** After deploy, `fetch
   <apiWorkerUrl>/api/ping` and assert `{ ok: true }`; surface pass/fail via the
   spinner. Re-use the captured URL — no new constant.

### (c) README "Deploy to Cloudflare" button — **API worker only**

**Rationale.** The Deploy button can't express the two-worker topology / monorepo
layout, so it deploys only the API worker (`shopflare-worker`) as a low-friction
"try it" entry. The **CLI wizard remains the real install path** (both workers +
`NEXT_PUBLIC_WORKER_URL` wiring + migrations + Stripe webhook).

- Add the button + URL to `README.md` with an explicit callout: "this deploys the
  API worker only; run `pnpm setup` for a full store."
- Point it at `wrangler.toml` (API worker). Do not wire it to
  `wrangler.frontend.jsonc`.

### (d) #12 — `.github/workflows/deploy.yml` (both workers, DISABLED)

- New workflow using `cloudflare/wrangler-action` to deploy **both** workers:
  one step `wrangler deploy` (API, `wrangler.toml`) and one step
  `opennextjs-cloudflare build && … deploy -c wrangler.frontend.jsonc`
  (frontend) — mirror the `pnpm worker:deploy` / `pnpm web:deploy` scripts.
- **Disabled by default:** trigger is `workflow_dispatch` only **and** guarded by
  a repo variable check (e.g. `if: vars.ENABLE_GH_DEPLOY == 'true'`). No `push`
  trigger. The user keeps deploying from the CLI until they opt in.
- **Do not modify `ci.yml`.** This is a separate file.
- Document required **GitHub secrets**: `CLOUDFLARE_API_TOKEN`,
  `CLOUDFLARE_ACCOUNT_ID`. Token scopes kept **minimal**: Account Settings:Read,
  Workers Scripts:Edit, Workers KV Storage:Edit, Workers R2 Storage:Edit,
  D1:Edit. Worker runtime secrets (Stripe/Resend/etc.) still travel via
  `wrangler secret put` or are mirrored as GH secrets only if CI needs them —
  document, do not commit.

### (e) Keep budget alerts + custom domain as printed manual steps

No reliable API for CF budget/billing alerts or custom-domain attach for a
non-dev merchant. Keep these as the **final printed manual steps** in the wizard
note and in the guide, with dashboard links. Out of automation scope.

## 4. Schema / DB changes

**None.** No migrations, no `db/schema.ts` edits. `db:migrate` / `db:seed`
continue to target `shopflare-db0` against the (now auto-provisioned) D1.

## 5. Security

- **Minimal token scopes** for `CLOUDFLARE_API_TOKEN` (listed in 3(d)); no
  broad/global keys.
- **Never commit tokens or ids-as-secrets.** Real resource ids stay out of the
  committed `wrangler.toml`; any maintainer override is git-ignored.
- Worker secrets only via `wrangler secret put` (wizard) or GitHub Actions
  secrets (deploy pipeline). `STRIPE_WEBHOOK_SECRET` is captured in-memory from
  the Stripe API response and piped straight to `wrangler secret put` — never
  written to disk or logged.
- **Do not read `.env.local` / `.dev.vars` / any secrets file.** Wizard writes
  `.env.local` but the plan/work never reads existing secret contents.
- Turnstile stays enforced in production only (dev bypass unchanged); the wizard
  still collects `TURNSTILE_*`.
- Stripe webhook handler must keep verifying the signature with the captured
  secret (unchanged behavior).

## 6. Rollout (small, conventional commits)

1. `chore(config): strip hardcoded D1/KV ids from wrangler.toml for auto-provision`
   (+ comment + maintainer override note; `.gitignore` if override file chosen).
2. `docs(setup): document maintainer re-link / local override for auto-provision`.
3. `refactor(setup): drop manual create + patchToml in favor of auto-provision`
   (also removes `store-*` name mismatch; version-guarded fallback).
4. `feat(setup): auto-create Stripe webhook + set STRIPE_WEBHOOK_SECRET`.
5. `feat(setup): post-deploy /api/ping smoke check`.
6. `fix(setup): replace stale Pages/CF-Access end text with two-workers+Bearer`.
7. `docs(readme): add Deploy-to-Cloudflare button (API worker only)`.
8. `ci(deploy): add disabled GitHub→CF deploy workflow for both workers`.
9. `docs(setup): rewrite cloudflare-guide + quickstart to current design`.
10. `docs(setup): add github-deploy guide for enabling the pipeline`.
11. Final: `pnpm verify` green, then `git mv` this plan to `done/`.

## 7. Acceptance

- A **fresh fork** can go fork → live entirely via `pnpm setup`: D1/KV/R2 are
  **auto-provisioned** (no id paste), migrations + seed apply, secrets set, both
  workers deploy, `NEXT_PUBLIC_WORKER_URL` wired, and the **Stripe webhook is
  auto-created with `STRIPE_WEBHOOK_SECRET` set**.
- Post-deploy `/api/ping` smoke check returns `{ ok: true }`.
- **Maintainer deploy still works** against the original `shopflare-db0` / KV /
  `shopflare-images0` data (via the documented override/re-link) — no orphaned or
  duplicated resources.
- `deploy.yml` is present, deploys both workers when manually dispatched with
  `ENABLE_GH_DEPLOY=true`, and **does NOT run on push**.
- **No Pages / CF Access / `CF_ACCESS_*` text** remains in the wizard or setup
  docs; everything reflects two workers + Bearer.
- `pnpm verify` (typecheck → lint → unit+coverage → integration → build) is
  **green**.

## 8. Non-goals

- No hosted multi-tenant onboarding / SaaS signup — this is fork-and-self-host.
- No automating CF **budget alerts** or **custom-domain** attach (no good API;
  stay manual printed steps).
- Not switching the **primary deploy** to GitHub Actions — the pipeline ships
  disabled; CLI stays the default.
- No change to admin auth, Turnstile, Stripe Checkout, or DB schema.
- Deploy button does **not** attempt the two-worker topology.

## 9. Docs to update

- [`docs/setup/cloudflare-guide.md`](../../setup/cloudflare-guide.md) — rewrite to
  current design: two workers + Bearer, auto-provisioned D1/KV/R2, auto Stripe
  webhook, maintainer override/re-link note. Remove Pages/CF-Access.
- [`docs/setup/quickstart.md`](../../setup/quickstart.md) — align to the new
  `pnpm setup` flow; drop stale Pages steps.
- **New** `docs/setup/github-deploy.md` — how to enable the disabled pipeline
  (set `ENABLE_GH_DEPLOY=true`, add `CLOUDFLARE_API_TOKEN` with the listed
  minimal scopes + `CLOUDFLARE_ACCOUNT_ID`, dispatch the workflow).
- [`README.md`](../../../README.md) — Deploy-to-Cloudflare button (API-worker-only
  callout) + updated setup pointer.
- Fix the wizard's **printed steps + docstring** in
  [`scripts/setup/index.mts`](../../../scripts/setup/index.mts).
- [`CONTEXT.md`](../../../CONTEXT.md) — update the "Setup Wizard" glossary entry if
  its scope changed (now auto-provisions + auto-webhook).
- `git mv` this plan `proposed/ → done/` as the final step once audited.

## 10. Self-audit checklist

- [ ] Hardcoded D1/KV ids stripped from `wrangler.toml`; maintainer deploy
      preserved via documented override/re-link (original data intact).
- [ ] Auto-provisioning verified on a **clean fork** (fresh D1/KV/R2 created and
      stay linked across a second deploy).
- [ ] Stripe webhook **auto-created** at `<apiWorkerUrl>/api/stripe/webhook` and
      `STRIPE_WEBHOOK_SECRET` set; secret never logged or written to disk.
- [ ] Stale Pages / CF-Access / `CF_ACCESS_*` text removed **everywhere**
      (wizard docstring + end note + `cloudflare-guide.md` + `quickstart.md`).
- [ ] `store-db` / `STORE_KV` / `store-images` name mismatch gone.
- [ ] `deploy.yml` is disabled by default (`workflow_dispatch` + guard var, no
      `push`) and fully documented in `github-deploy.md`; `ci.yml` untouched.
- [ ] `CLOUDFLARE_API_TOKEN` documented with **minimal** scopes only.
- [ ] No secrets or real resource ids read, displayed, or committed.
- [ ] Post-deploy `/api/ping` smoke check present and passing.
- [ ] `pnpm verify` green.
- [ ] This plan re-read end-to-end before marking done; `git mv` to `done/`.
