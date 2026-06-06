import { defineWorkersConfig, readD1Migrations } from '@cloudflare/vitest-pool-workers/config'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.dirname(fileURLToPath(import.meta.url))
const r = (p: string) => path.join(root, p)

// Async factory form (avoids a top-level await in the bundled config). Reads the
// Drizzle D1 migrations once; the apply-migrations setup file runs them against
// the ephemeral miniflare D1 before each test file.
export default defineWorkersConfig(async () => {
  const migrations = await readD1Migrations(r('worker/db/migrations'))

  return {
    resolve: {
      alias: {
        '@': r('src'),
        worker: r('worker'),
      },
    },
    test: {
      name: 'integration',
      include: ['worker/test/**/*.test.ts'],
      setupFiles: ['./worker/test/apply-migrations.ts'],
      // No coverage block here on purpose. This project runs in the Cloudflare
      // workers pool (miniflare/workerd); v8 coverage instruments the node process,
      // not the out-of-process runtime, so worker routes falsely report 0%. The
      // integration suite's job is behavioural ("every route exercised end-to-end"),
      // not line coverage. The 95% line gate lives on the unit project only.
      poolOptions: {
        workers: {
          // Reuse the real worker entry + bindings (D1/KV/R2, nodejs_compat).
          wrangler: { configPath: './wrangler.toml' },
          miniflare: {
            // ENVIRONMENT=development → Turnstile + CF Access dev-bypass, so
            // public POSTs and admin routes are reachable without tokens.
            // Dummy Stripe keys let the webhook construct its client so the
            // signature check runs (and rejects a forged signature with 400).
            bindings: {
              ENVIRONMENT: 'development',
              ADMIN_DEV_BYPASS: '1',
              STRIPE_SECRET_KEY: 'sk_test_dummy',
              STRIPE_WEBHOOK_SECRET: 'whsec_dummy',
              TEST_MIGRATIONS: migrations,
            },
          },
        },
      },
    },
  }
})
