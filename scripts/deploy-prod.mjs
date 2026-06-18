#!/usr/bin/env node
// One-shot production deploy, run strictly in order (fail-fast — any non-zero exit aborts):
//   1. D1 migrations (prod)              — schema is ready BEFORE the new code that needs it
//   2. API worker (shopflare-worker)     — wrangler.prod.toml, ENVIRONMENT=production
//   3. Frontend worker (shopflare-web)   — OpenNext; runs its own env-isolation preflight + build
//
// Does NOT push secrets (run `pnpm secrets:prod` when .prod.vars changes) and does NOT seed
// (seeding is a one-time `pnpm db:seed:prod`). Production deploy — only run with intent.
import { execSync } from 'node:child_process'

const steps = [
  ['1/3  D1 migrations (prod)', 'pnpm db:migrate:prod'],
  ['2/3  API worker (shopflare-worker)', 'pnpm worker:deploy:prod'],
  ['3/3  Frontend (shopflare-web)', 'pnpm web:deploy'],
]

for (const [label, cmd] of steps) {
  console.log(`\n▶ ${label}\n  $ ${cmd}`)
  try {
    execSync(cmd, { stdio: 'inherit' })
  } catch {
    console.error(`\n✘ deploy aborted at step: ${label}`)
    process.exit(1)
  }
}

console.log('\n✓ prod deploy complete — migrations applied, API worker + frontend deployed.')
