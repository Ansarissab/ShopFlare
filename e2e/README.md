# E2E Tests

Playwright smoke + E2E + visual + a11y test suite.

## Commands

  pnpm test:smoke           @smoke critical-path specs (boots own server, dynamic port)
  pnpm test:e2e             full E2E suite excluding @smoke and visual: specs
  pnpm test:visual          visual regression against local baselines (native, no Docker)
  pnpm test:visual:update   regenerate machine-local baselines
  pnpm test:e2e:ui          Playwright UI mode
  pnpm test:all             unit coverage + integration + full E2E

## CI gate (`pnpm verify`)

One command runs the whole quality bar, fail-fast (the Rails `bin/ci` idea):

  pnpm verify              typecheck → lint+build+unit → integration → smoke → e2e
  pnpm verify --visual     full gate + native visual regression (opt-in)
  pnpm verify --quick      typecheck + lint + unit only (fast dev loop; skips integration/smoke/e2e)
  pnpm verify --no-build   skip the production build

(`pnpm run ci` is an alias — bare `pnpm ci` is a reserved pnpm builtin, so use
`pnpm verify` or `pnpm run ci`.)

Step ordering:
  1. typecheck          — fail-fast, ~5s
  2. lint + build + unit+coverage — concurrent (ONE test process; build overlaps to save ~70s)
  3. integration        — miniflare/workerd, sequential
  4. smoke              — @smoke critical-path specs, sequential, fail-fast before full e2e
  5. e2e                — full suite excluding @smoke + visual: (no double-running), sequential
  6. visual             — native screenshot regression (opt-in: pnpm verify --visual)

Integration and smoke run sequentially (not concurrently) because measured CPU contention
caused timeouts. Port ranges are separated so smoke (3100/8887) and e2e (3200/8987)
never collide if invoked externally in parallel.

## Port allocation

Smoke and e2e each boot their own Next.js dev server + wrangler worker on
dynamically-scanned free ports (base port from env: E2E_APP_PORT_BASE /
E2E_WORKER_PORT_BASE). You can run `pnpm test:e2e` or `pnpm test:smoke` while
`pnpm dev` is already running — they won't collide.

## Seed data

The dev worker uses `worker/db/seed.sql`, which seeds products AND categories
(Apparel, Accessories) so storefront and e2e tests have category data available.

## Coverage scope

The 95% gate runs on the **unit project only** (`pnpm test:coverage` =
`vitest run --project unit --coverage`). Worker routes run in the miniflare/workerd pool
where v8 can't instrument them, so they're covered **behaviorally** by the integration
suite instead. Full rationale + exclusion list: `docs/adr/0008-coverage-gate-unit-only.md`.

## Visual Regression

Baselines live in `.visual-baselines/` (gitignored, persistent across reboots).
Generate on main: `pnpm test:visual:update`
Switch branch, then run: `pnpm test:visual` to diff.

Visual runs natively on the host machine — no Docker. Baselines are machine-specific; if
they are stale after a Playwright upgrade or UI change, regenerate with:
  pnpm test:visual:update

## Layers

Layer         | Tool                   | Gate
--------------|------------------------|-------------------------
Unit          | vitest node            | 95% coverage threshold (the gate)
Integration   | vitest miniflare       | every worker route (behavioral, no % gate)
Component     | vitest jsdom           | every interactive component
Smoke         | Playwright @smoke      | critical paths, < 60s
E2E           | Playwright             | full store + admin flows
A11y          | axe-core/playwright    | no serious/critical
Visual        | Playwright screenshots | local .visual-baselines/ (native, opt-in)
