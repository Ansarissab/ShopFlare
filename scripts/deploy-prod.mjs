#!/usr/bin/env node
// One-shot production deploy, parallelized into two independent tracks:
//
//   Track A (sequential):  D1 migrations  →  API worker (shopflare-worker)
//   Track B:               Frontend (shopflare-web, OpenNext)
//
// A and B run CONCURRENTLY (the frontend build is the long pole, so overlapping it with
// the migrate+API track is the real time win). Within Track A the order is REQUIRED, not a
// preference: a schema-changing migration must land before the API worker that depends on
// it goes live, or the new worker 500s on missing columns. The frontend is independent of
// the API deploy — its service binding resolves to the already-deployed shopflare-worker —
// so it parallelizes safely.
//
// Does NOT push secrets (run `pnpm secrets:prod` when .prod.vars changes) or seed
// (one-time `pnpm db:seed:prod`). Production deploy — only run with intent.
import { spawn } from 'node:child_process'

/** Run one command, streaming its output; resolve on exit 0, reject otherwise. */
function run(label, cmd) {
  return new Promise((resolve, reject) => {
    console.log(`\n▶ ${label}\n  $ ${cmd}`)
    const child = spawn(cmd, { stdio: 'inherit', shell: true })
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${label} failed (exit ${code})`)),
    )
  })
}

/** Run steps strictly in order; stop the chain on the first failure. */
async function chain(...steps) {
  for (const [label, cmd] of steps) await run(label, cmd)
}

console.log('▶ prod deploy — Track A (migrate → API) ∥ Track B (frontend), concurrent')

const results = await Promise.allSettled([
  chain(
    ['A1  D1 migrations (prod)', 'pnpm db:migrate:prod'],
    ['A2  API worker (shopflare-worker)', 'pnpm worker:deploy:prod'],
  ),
  run('B   Frontend (shopflare-web)', 'pnpm web:deploy'),
])

const failures = results.filter((r) => r.status === 'rejected')
if (failures.length > 0) {
  for (const f of failures) console.error(`\n✘ ${f.reason.message}`)
  console.error(
    '\n✘ prod deploy FAILED — see the errors above. (A concurrent track may have completed.)',
  )
  process.exit(1)
}

console.log('\n✓ prod deploy complete — migrations + API worker + frontend deployed.')
