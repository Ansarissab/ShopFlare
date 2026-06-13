import { defineConfig, devices } from '@playwright/test'
import { ADMIN_STORAGE_STATE, E2E_ADMIN_PASSWORD, E2E_ADMIN_SESSION_SECRET } from './e2e/constants'

// Ports come from the e2e launcher (scripts/e2e.mjs), which scans for free ports
// ONCE and exports them as PW_PORT / PW_WORKER_PORT so this config AND every
// Playwright worker share the same values. Run e2e via `pnpm test:e2e` (not bare
// `playwright test`) so both vars are set; without them we fall back to 3000/8787.
// A busy :3000 or :8787 (e.g. user's own procfile) never blocks e2e.
const explicitBase = process.env.BASE_URL
const port = explicitBase
  ? Number(new URL(explicitBase).port || 3000)
  : Number(process.env.PW_PORT ?? 3000)
const baseURL = explicitBase ?? `http://localhost:${port}`
// Worker port: dynamic from launcher, or 8787 fallback for bare `playwright test`.
const workerPort = Number(process.env.PW_WORKER_PORT ?? 8787)

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // 1 local retry absorbs the occasional load-induced flake (heavy flows like
  // checkout can time out under CPU pressure); only the failing test re-runs.
  retries: process.env.CI ? 2 : 1,
  // Local: cap at 3 (was unbounded → up to 8 browser workers on an 8-core box).
  // CI stays single-worker for deterministic timing.
  workers: process.env.CI ? 1 : 3,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' },
  },
  snapshotPathTemplate: '.visual-baselines/{projectName}/{testFilePath}/{arg}{ext}',
  // Skip the managed server when BASE_URL points at an already-running target.
  webServer: explicitBase
    ? undefined
    : {
        // Port the Next frontend EXPLICITLY (`-p`), not via the PORT env — both
        // next dev AND wrangler dev read PORT, so a shared env makes the worker
        // grab the port and Playwright would hit the API (401/404) instead of the
        // app. The worker uses a dynamic port (PW_WORKER_PORT, fallback 8787) so a
        // busy :8787 (user's procfile worker) never blocks this suite. The
        // NEXT_PUBLIC_WORKER_URL prefix tells both client and SSR fetches where the
        // worker is; worker-url.ts accepts any http://localhost:<port> in dev.
        // --inspector-port 0 lets the OS pick a free inspector port so the default
        // :9229 doesn't collide with another running Node/wrangler process.
        command: `pnpm exec concurrently -k -n web,worker -c cyan,magenta "NEXT_PUBLIC_WORKER_URL=http://localhost:${workerPort} pnpm exec next dev -p ${port}" "pnpm exec wrangler dev worker/index.ts --port ${workerPort} --inspector-port 0 --var ENVIRONMENT:development --var ADMIN_DEV_BYPASS:1 --var ADMIN_PASSWORD:${E2E_ADMIN_PASSWORD} --var ADMIN_SESSION_SECRET:${E2E_ADMIN_SESSION_SECRET}"`,
        url: baseURL,
        // Always boot our own server on the free port — never reuse a foreign
        // process squatting on :3000.
        reuseExistingServer: false,
        timeout: 120_000,
      },
  projects: [
    // Logs in once and writes the shared admin storageState; runs before the rest.
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    // storageState (the shared admin login) is applied once here, not per spec —
    // store specs simply carry an unused token. Both projects depend on `setup`.
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], storageState: ADMIN_STORAGE_STATE },
      dependencies: ['setup'],
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 5'], storageState: ADMIN_STORAGE_STATE },
      dependencies: ['setup'],
    },
  ],
})
