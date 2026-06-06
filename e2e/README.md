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

  pnpm verify              typecheck → lint → unit+coverage → integration → build
  pnpm verify --quick      typecheck + lint + unit only (fast loop)
  pnpm verify --no-build   skip the production build

(`pnpm run ci` is an alias — bare `pnpm ci` is a reserved pnpm builtin, so use
`pnpm verify` or `pnpm run ci`.)

E2E / visual / a11y are NOT in `pnpm ci` (they need a running dev server + Chromium) —
run them with the commands above.

## Coverage scope

The 95% gate runs on the **unit project only** (`pnpm test:coverage` =
`vitest run --project unit --coverage`). Worker routes run in the miniflare/workerd pool
where v8 can't instrument them, so they're covered **behaviorally** by the integration
suite instead. Full rationale + exclusion list: `docs/adr/0008-coverage-gate-unit-only.md`.

## Visual Regression

Baselines live in .visual-baselines/ (gitignored, persistent across reboots).
Generate on main: pnpm test:visual:update
Switch branch, then run: pnpm test:visual to diff.

Cross-OS determinism: pnpm test:visual:docker (runs inside playwright-jammy container).

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
