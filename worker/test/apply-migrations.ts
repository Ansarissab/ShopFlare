// Runs the Drizzle D1 migrations against the ephemeral miniflare D1 before tests.
// TEST_MIGRATIONS is injected by vitest.integration.config.ts.
import { applyD1Migrations, env } from 'cloudflare:test'

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
