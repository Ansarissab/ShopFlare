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
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'json-summary'],
        reportsDirectory: './coverage',
        thresholds: { lines: 95, functions: 95, branches: 95, statements: 95 },
        exclude: [
          '**/*.test.*',
          '**/*.spec.*',
          '**/*.config.*',
          '**/types/**',
          'e2e/**',
          '.next/**',
          '**/node_modules/**',
          'src/components/ui/**',
          'worker/db/schema.ts',
          'worker/db/migrations/**',
          'src/app/**/*.tsx',
          'src/middleware.ts',
        ],
      },
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
