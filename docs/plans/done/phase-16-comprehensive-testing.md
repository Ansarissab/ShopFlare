# Plan 16 — Comprehensive Testing Strategy (unit → integration → component → smoke → e2e/regression → visual → a11y)

> **For the implementer (Sonnet):** Execute end-to-end. Follow CLAUDE.md DRY rules.
> UI strings live in `lib/i18n/en.ts` — locate by ROLE/TEXT, never CSS/screenshot
> (visual layer excepted). No new raw `fetch()` in app code. Do **not** `git push` or
> open a PR. Small focused commits per §11.

---

## 1. Goal

Heavy, multi-layer automated testing to harden UX. Every layer of the pyramid, run
**locally**, no SaaS, **zero binary baselines or artifacts tracked in git**.

Locked decisions (user):
- **Coverage: Store + Admin, full.**
- **Aggressiveness: MAX + enforced gate** — expand unit/integration/component to cover
  every route/util/schema/hook/component, and **fail the suite below a 95% threshold**.
- **Visual regression: yes, but baselines NOT git-tracked** — Playwright native
  `toHaveScreenshot()` with baselines in a **gitignored persistent folder**
  (`.visual-baselines/`). Local-only. Docker render container is the cross-OS escape hatch.
- **a11y: yes** — `@axe-core/playwright`, fail on serious/critical.
- **CI: local-only for now.** Everything runs on the dev machine. GitHub Actions deferred.

### Tradeoff the user accepted (visual)
Untracked baselines mean **no shared source of truth** and **no PR diffs**. Visual
regression is a *local* workflow: regenerate baselines on `main`, switch branch, run,
inspect pixel diffs. Cross-machine/OS font AA differences → use the Docker container
(§8) to make baselines deterministic.

---

## 2. Layer map

| Layer        | Tool                          | New? | Gate                         |
|--------------|-------------------------------|------|------------------------------|
| Unit         | vitest (node)                 | grow | 95% coverage threshold       |
| Integration  | vitest workers pool (miniflare)| grow | every worker route covered   |
| Component    | vitest jsdom                  | grow | every interactive component  |
| **Smoke**    | Playwright `@smoke` grep      | new  | all routes 200, boot <60s    |
| **E2E/regr.**| Playwright                    | new  | full store+admin flows       |
| **Visual**   | Playwright `toHaveScreenshot` | new  | gitignored baselines         |
| **A11y**     | @axe-core/playwright          | new  | no serious/critical          |

Smoke = a fast tagged subset of the Playwright suite, not a new framework.
Regression = a *discipline*: every fixed bug gets a permanent test (§9), plus the full
suite is the regression net.

---

## 3. Why these tools

- **vitest** — already the unit+integration runner. Keep. Add coverage gate.
- **Playwright** — parallel, auto-wait, multi-project (desktop+mobile), native visual
  snapshots, trace viewer. One tool covers smoke + e2e + visual + a11y host.
- **Rejected:** Cypress (heavier/slower), Argos/Chromatic/Percy (SaaS, unwanted),
  Storybook-based visual (no Storybook in repo).

---

## 4. Stack is E2E-ready (no app hacks)

- **Turnstile** — `TurnstileWidget.tsx` uses CF test sitekey `1x…AA` in non-prod;
  `worker/lib/turnstile.ts` bypasses verify when `TURNSTILE_SECRET_KEY` unset. Forms
  submit cleanly. No change.
- **CF Access** — edge-only; admin fully reachable under `wrangler dev`. No change.
- **D1 seed** — `worker/db/seed.sql` → deterministic data; reset between destructive specs.
- **Stripe** — assert redirect toward `checkout.stripe.com` only; E2E the COD path.

---

## 5. Unit / Integration / Component — MAX coverage + gate

### 5.1 Coverage gate (`vitest.config.ts` + integration config)
Enable v8 coverage (already have `@vitest/coverage-v8`) with thresholds:
```ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'html', 'json-summary'],
  reportsDirectory: './coverage',          // already gitignored
  thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
  exclude: ['**/*.test.*', '**/*.config.*', '**/types/**', 'e2e/**', '.next/**'],
}
```
`pnpm test:coverage` fails under 95%. Wire same gate across the workspace.

### 5.2 Unit — expand to cover all of:
- `lib/schemas/*` (every Zod schema: valid + invalid + edge), `lib/utils/*`,
  `lib/search/*`, `lib/constants` invariants, `worker/lib/money`, `worker/lib/orders`,
  any pure helper.

### 5.3 Integration — workers pool, cover **every** `worker/routes/*`:
- products, categories, orders (COD + Stripe intent), reviews, notify, push, stripe
  webhook (signature verify path), admin config GET/PUT, coupons, analytics.
- Assert D1 writes, KV cache headers/304s, R2 image paths, Turnstile bypass, rate-limit.

### 5.4 Component — jsdom, cover every interactive component:
- store: ProductCard, VariantSelector, SizePicker, ImageCarousel, ProductActions,
  NotifyMeDialog, CartItem/Sheet/Summary, FreeShippingBar, SearchBar (✅), CategoryFilter/Nav,
  TrackingForm, OrderTimeline, ReviewForm/Stars, TurnstileWidget (mock `window.turnstile`).
- admin: forms + tables (render, validation errors, submit handlers mocked via `lib/api`).
- Use `@testing-library/react`; assert by role/text; userEvent interactions.

---

## 6. Playwright — config (`playwright.config.ts`)

- `testDir: './e2e'`, `fullyParallel: true`, `retries: process.env.CI ? 2 : 0`
- `reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]`
- `use`: `trace: 'on-first-retry'`, `video: 'on-first-retry'`,
  functional `screenshot: 'only-on-failure'`
- `snapshotPathTemplate: '.visual-baselines/{projectName}/{testFilePath}/{arg}{ext}'`
  → **gitignored** baseline dir (persistent across runs, survives reboot)
- `expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' } }`
- `webServer`: `pnpm dev:all`, `reuseExistingServer: !CI`, `timeout: 120_000`
- `projects`: `chromium-desktop` (Desktop Chrome) + `chromium-mobile` (Pixel 5)
- `grep`/tagging: smoke tests titled with `@smoke`.

---

## 7. Specs — `e2e/**`

### 7.1 Fixtures — `e2e/fixtures.ts`
Custom `test` auto-applying:
- **Console guard** — fail on `console.error`/`pageerror` (allowlist param).
- **Network guard** — fail on responses ≥400 (allowlist param).
- **axe helper** — `checkA11y(page)` fails on serious/critical.
- **Domain helpers** — `addToCart()`, `seedReset()` (re-apply `seed.sql` to local D1).

### 7.2 Smoke — `e2e/smoke.spec.ts` (`@smoke`)
Every top-level route returns 200 and renders its landmark heading; app boots; no console
errors. Target run < 60s. This is the fast gate before the heavy suite.

### 7.3 Store E2E — `e2e/store/`
`home`, `product`, `cart-checkout` (COD → success → track), `tracking`, `policy-pwa`,
`responsive` (tab-bar vs header by role at mobile/desktop).

### 7.4 Admin E2E — `e2e/admin/`
`admin-crud` (product/category/coupon/settings persist), `admin-orders` (list, status
transition, POS quick order).

### 7.5 A11y — `e2e/a11y.spec.ts`
`checkA11y` on every top-level store + admin route.

### 7.6 Visual — `e2e/visual.spec.ts`
`toHaveScreenshot()` on stable views: home grid, product page, cart sheet, checkout form,
admin dashboard, key admin tables. Both projects (desktop+mobile).
- **Mask dynamic regions** (timestamps, order ids, anything random) via `mask:` option.
- `animations: 'disabled'`, wait for network idle + fonts ready before snapshot.
- Baselines auto-created on first `--update-snapshots`; never committed.

---

## 8. Determinism (Docker escape hatch)

Local OS font rendering differs → visual flake. Provide an opt-in stable renderer:
- `e2e/Dockerfile` from `mcr.microsoft.com/playwright:vX-jammy`.
- Script `test:visual:docker` runs the visual project inside the container so baselines
  and diffs use one consistent render engine regardless of host OS.
- Baselines generated in Docker stay in the same gitignored `.visual-baselines/`.

Use Docker only if/when host-local visual runs flake. Default path is host-local.

---

## 9. Regression discipline

- **Bug → test:** every UI/UX bug fixed from here on gets a permanent failing-then-passing
  test in the right layer (unit if logic, component if render, e2e if flow, visual if
  cosmetic). Reference the symptom in the test title.
- The **full suite** (`pnpm test:all`) is the regression net before any release.

---

## 10. Scripts + gitignore

### `package.json`
```
"test":              "vitest run",
"test:coverage":     "vitest run --coverage",
"test:e2e":          "playwright test",
"test:smoke":        "playwright test --grep @smoke",
"test:visual":       "playwright test e2e/visual.spec.ts",
"test:visual:update":"playwright test e2e/visual.spec.ts --update-snapshots",
"test:visual:docker":"docker build -t shopflare-visual e2e && docker run --rm -v $PWD/.visual-baselines:/work/.visual-baselines shopflare-visual",
"test:e2e:ui":       "playwright test --ui",
"test:all":          "pnpm test:coverage && pnpm test:e2e"
```

### `.gitignore` — add
```
/playwright-report
/.playwright
/.visual-baselines
/e2e/**/*-snapshots
```
(`/test-results` and `/coverage` already ignored.)

---

## 11. Rollout (small commits)

1. `chore(test): coverage gate (95%) on vitest unit + integration`
2. `test(unit): cover all schemas/utils/search/money helpers to gate`
3. `test(integration): cover every worker route + D1/KV/R2 paths`
4. `test(component): cover all store + admin interactive components`
5. `chore(e2e): playwright config + deps + gitignore (incl .visual-baselines)`
6. `feat(e2e): fixtures — console/network guards + axe + seed reset`
7. `test(e2e): smoke route sweep (@smoke)`
8. `test(e2e): store flows (home, product, cart-checkout, tracking, policy, responsive)`
9. `test(e2e): admin flows (crud, orders, pos)`
10. `test(e2e): a11y route sweep`
11. `test(visual): baseline snapshots + Docker render container`
12. `docs(test): e2e/README + mark phase-16 done`

---

## 12. Acceptance

- `pnpm test:coverage` green **and** ≥95% on lines/functions/branches/statements.
- `pnpm test:smoke` < 60s, all routes 200.
- `pnpm test:e2e` green on desktop + mobile projects.
- `pnpm test:visual` green against locally-generated baselines; a deliberate style change
  produces a visible pixel diff.
- A deliberately broken button fails the matching spec with a readable trace.
- `git status` after a full green run shows **no** new tracked files — baselines,
  reports, coverage, traces all gitignored.
- Existing `pnpm test` behavior preserved (now with gate).

---

## 13. Non-goals

- No visual SaaS (Argos/Chromatic/Percy). No committed baseline PNGs.
- No CI wiring yet (local-only; revisit when stable).
- No load/perf testing (Phase 14 covered perf).
- No driving Stripe's hosted checkout UI.
