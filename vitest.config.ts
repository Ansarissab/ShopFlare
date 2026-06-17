import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Mirror the tsconfig path aliases so worker + src modules resolve in tests.
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineConfig({
  test: {
    // Cap parallelism to 3 workers (8-core box; 7 default workers thrash RAM/CPU
    // and OOM the run). Matches the project-wide "≤3 concurrent" rule.
    maxWorkers: 3,
    minWorkers: 1,
    // Replaces the deprecated `vitest.workspace.ts`. Two projects:
    //   unit        (threads pool) — pure-logic + jsdom component tests, fast
    //   integration (workers pool) — real worker + D1/KV/R2 via miniflare
    // `pnpm test` runs both; `pnpm test:unit` / `--project unit` runs just one.
    projects: [
      {
        // Unit project (was the body of this file before the workspace migration).
        resolve: {
          alias: {
            '@': r('./src'),
            worker: r('./worker'),
          },
        },
        test: {
          name: 'unit',
          // `threads` over Vitest's default `forks`: threads share memory so jsdom
          // environments spin up without per-file fork IPC overhead. Measured ~13%
          // faster wall-clock on this suite (forks 168s → threads 146s, run2), no
          // isolation issues. `maxWorkers: 3` (root) still bounds concurrency.
          pool: 'threads',
          // Default to node (fast, no DOM). Component tests opt into jsdom per-file
          // via a `@vitest-environment jsdom` docblock — only the `.tsx` files pay.
          environment: 'node',
          include: ['{src,worker}/**/*.{test,spec}.{ts,tsx}'],
          // Integration tests run in the workers pool (vitest.integration.config.ts),
          // not the node pool — keep them out of the unit project.
          exclude: ['worker/test/**', '**/node_modules/**'],
        },
      },
      './vitest.integration.config.ts',
    ],
    // Coverage lives at the ROOT so the 95% gate is enforced when running
    // `vitest run --project unit --coverage` (v8 instruments the node pool cleanly;
    // the workers-pool integration project is covered behaviorally, not by line %).
    coverage: {
      provider: 'v8' as const,
      reporter: ['text-summary', 'json-summary'],
      reportsDirectory: './coverage',
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
        // CF-runtime worker/lib — wrap D1/KV/R2/Stripe/Resend + external IO;
        // exercised end-to-end by the integration suite, not unit-testable in node.
        'worker/lib/stripe.ts',
        'worker/lib/push.ts',
        'worker/lib/analytics.ts',
        'worker/lib/access.ts',
        'worker/lib/categories.ts',
        'worker/lib/notify.ts',
        'worker/lib/products.ts',
        'worker/lib/orders.ts',
        'worker/lib/health.ts',
        'worker/lib/reviews.ts',
        'worker/lib/sanitize.ts',
        'worker/lib/landing.ts',
      ],
    },
  },
})
