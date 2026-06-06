# E2E Tests

Playwright smoke + E2E + visual + a11y test suite.

## Commands

  pnpm test:smoke           fast smoke sweep (<60s)
  pnpm test:e2e             full E2E suite (desktop + mobile)
  pnpm test:visual          visual regression (needs baselines)
  pnpm test:visual:update   regenerate baselines
  pnpm test:e2e:ui          Playwright UI mode
  pnpm test:all             vitest coverage + full E2E

## Visual Regression

Baselines live in .visual-baselines/ (gitignored, persistent across reboots).
Generate on main: pnpm test:visual:update
Switch branch, then run: pnpm test:visual to diff.

Cross-OS determinism: pnpm test:visual:docker (runs inside playwright-jammy container).

## Layers

Layer         | Tool                   | Gate
--------------|------------------------|-------------------------
Unit          | vitest node            | 95% coverage threshold
Integration   | vitest miniflare       | every worker route
Component     | vitest jsdom           | every interactive component
Smoke         | Playwright @smoke      | all routes 200, < 60s
E2E           | Playwright             | full store + admin flows
A11y          | axe-core/playwright    | no serious/critical
Visual        | Playwright screenshots | local .visual-baselines/
