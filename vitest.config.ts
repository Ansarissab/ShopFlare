import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Mirror the tsconfig path aliases so worker + src modules resolve in tests.
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': r('./src'),
      worker: r('./worker'),
    },
  },
  test: {
    name: 'unit',
    // Cap parallelism to 3 workers (machine has 8 cores; 7 default workers thrash
    // RAM/CPU and slow the run rather than speed it up). 3 is the sweet spot here
    // and matches the project-wide "≤3 concurrent" rule.
    maxWorkers: 3,
    minWorkers: 1,
    // Default to node (fast, no DOM). Component tests opt into jsdom per-file via
    // a `@vitest-environment jsdom` docblock — only the `.tsx` files pay for it.
    environment: 'node',
    include: ['{src,worker}/**/*.{test,spec}.{ts,tsx}'],
    // Integration tests run in the workers pool (vitest.integration.config.ts),
    // not the node pool — keep them out of the unit project.
    exclude: ['worker/test/**', '**/node_modules/**'],
    coverage: {
      provider: 'v8' as const,
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: './coverage',
      // The 95% gate is enforced on the UNIT project only (node pool), where v8
      // instruments cleanly. The integration project runs in the workers pool
      // (miniflare/workerd) — v8 can't instrument out-of-process code, so worker
      // routes would falsely read 0%. Those routes ARE covered, by the integration
      // suite (every route exercised via SELF.fetch); that's a separate boolean gate.
      // `all: true` + explicit include = the gate measures the real unit surface,
      // not just files that happen to be imported by a test.
      all: true,
      include: ['src/**/*.{ts,tsx}', 'worker/lib/**/*.ts'],
      thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
      exclude: [
        '**/*.test.*',
        '**/*.spec.*',
        '**/*.config.*',
        '**/*.d.ts',
        '**/types/**',
        'src/lib/types/**',
        'e2e/**',
        '.next/**',
        '**/node_modules/**',
        // shadcn/ui primitives — vendored, not our logic to test
        'src/components/ui/**',
        // Server components / pages — exercised by Playwright E2E, not unit tests
        'src/app/**',
        // PWA service worker — runs in SW scope, tested via E2E
        'src/sw.ts',
        'public/**',
        // CF-runtime worker/lib — these wrap D1/KV/R2/Stripe/Resend and external
        // IO; they're exercised end-to-end by the integration suite (workers pool),
        // not unit-testable in the node pool without mocking away their entire body.
        'worker/lib/stripe.ts',
        'worker/lib/push.ts',
        'worker/lib/analytics.ts',
        'worker/lib/access.ts',
        'worker/lib/categories.ts',
        'worker/lib/notify.ts',
        'worker/lib/products.ts',
        // createOrder — the COD/Stripe order-assembly pipeline (stock checks,
        // coupon application, D1 inserts). Exercised thoroughly by the integration
        // suite (order creation, stock decrement, coupons) — mocking the entire
        // Drizzle db to unit-test it would be brittle and low-value.
        'worker/lib/orders.ts',
        // healthProbe — wraps D1/KV/R2 binding calls; exercised end-to-end by the
        // integration suite (happy path + forced binding failure → 503).
        'worker/lib/health.ts',
        // reviews + sanitize — wrap D1 and use CF helper types;
        // covered behaviorally by the integration suite.
        'worker/lib/reviews.ts',
        'worker/lib/sanitize.ts',
      ],
    },
  },
})
