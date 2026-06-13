# E2E Tests

Playwright smoke + E2E + visual + a11y test suite.

## Commands

  pnpm test:smoke           fast smoke sweep (<60s)
  pnpm test:e2e             full E2E suite (desktop + mobile)
  pnpm test:visual          visual regression (needs baselines)
  pnpm test:visual:update   regenerate baselines
  pnpm test:e2e:ui          Playwright UI mode
  pnpm test:all             unit coverage + integration + full E2E

## CI gate (`pnpm verify`)

One command runs the whole quality bar, fail-fast (the Rails `bin/ci` idea):

  pnpm verify              typecheck → lint+build+unit → integration → smoke → e2e
  pnpm verify --visual     full gate + native visual regression
  pnpm verify --quick      typecheck + lint + unit only (fast loop, skips everything after unit)
  pnpm verify --no-build   skip the production build

(`pnpm run ci` is an alias — bare `pnpm ci` is a reserved pnpm builtin, so use
`pnpm verify` or `pnpm run ci`.)

Step ordering (all test processes sequential, never overlapping):
  1. typecheck          — fail-fast, ~5s
  2. lint + build + unit+coverage — concurrent (ONE test process)
  3. integration        — miniflare/workerd, alone
  4. smoke              — @smoke critical-path specs, fail-fast before full e2e
  5. e2e                — full suite excluding @smoke + visual: (no double-running)
  6. visual             — native screenshot regression (opt-in: pnpm verify --visual)

## Coverage scope

The 95% gate runs on the **unit project only** (`pnpm test:coverage` =
`vitest run --project unit --coverage`). Worker routes run in the miniflare/workerd pool
where v8 can't instrument them, so they're covered **behaviorally** by the integration
suite instead. Full rationale + exclusion list: `docs/adr/0008-coverage-gate-unit-only.md`.

## Visual Regression

Baselines live in .visual-baselines/ (gitignored, persistent across reboots).
Generate on main: pnpm test:visual:update
Switch branch, then run: pnpm test:visual to diff.

Visual runs natively on the host machine. Baselines are machine-specific; if they
are stale after a Playwright upgrade or UI change, regenerate with:
  pnpm test:visual:update

## Layers

Layer         | Tool                   | Gate
--------------|------------------------|-------------------------
Unit          | vitest node            | 95% coverage threshold (the gate)
Integration   | vitest miniflare       | every worker route (behavioral, no % gate)
Component     | vitest jsdom           | every interactive component
Smoke         | Playwright @smoke      | all routes 200, < 60s
E2E           | Playwright             | full store + admin flows
A11y          | axe-core/playwright    | no serious/critical
Visual        | Playwright screenshots | local .visual-baselines/
