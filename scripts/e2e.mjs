#!/usr/bin/env node
// e2e launcher. Finds ONE free port (scanning up from 3000) and exports it as
// PW_PORT before spawning Playwright, so the config AND every Playwright worker
// process share the same port. Doing the scan inside playwright.config.ts instead
// is unreliable: Playwright re-loads the config in each worker, so every worker
// would pick a *different* free port than the one the dev server actually booted on.
//
// Net effect: a busy :3000 (e.g. another local app) never collides — we boot our
// own ShopFlare dev server on the next free port. Any args are passed through:
//   node scripts/e2e.mjs --project=chromium-desktop
//   node scripts/e2e.mjs --grep @smoke
import net from 'node:net'
import { spawn, spawnSync } from 'node:child_process'

function freePort(start) {
  return new Promise((resolve) => {
    let p = start
    const tryPort = () => {
      if (p > start + 100) return resolve(start)
      const s = net.createServer()
      s.once('error', () => {
        p++
        tryPort()
      })
      s.once('listening', () => s.close(() => resolve(p)))
      s.listen(p, '127.0.0.1')
    }
    tryPort()
  })
}

// Seed the local D1 so the storefront is never empty during e2e. Both steps are
// idempotent: migrations are a no-op when already applied, and seed.sql uses
// INSERT OR IGNORE / INSERT OR REPLACE so re-runs are safe.
console.log('[e2e] Applying local D1 migrations…')
spawnSync('pnpm', ['db:migrate:local'], { stdio: 'inherit' })
console.log('[e2e] Seeding local D1…')
spawnSync('pnpm', ['db:seed:local'], { stdio: 'inherit' })

const port = process.env.PW_PORT || String(await freePort(3000))
// Scan a second free port for the worker, starting after the app port so they
// never collide. This removes the hardcoded :8787 dependency — if the user's
// procfile worker (or anything else) holds 8787, e2e still boots cleanly.
const workerPort = process.env.PW_WORKER_PORT || String(await freePort(Number(port) + 1))
const child = spawn('./node_modules/.bin/playwright', ['test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PW_PORT: String(port),
    PW_WORKER_PORT: String(workerPort),
    // Tell both the client fetch (lib/api.ts) AND the CSP (next.config.ts) where
    // the worker actually lives. worker-url.ts accepts any localhost:<port> in dev.
    NEXT_PUBLIC_WORKER_URL: `http://localhost:${workerPort}`,
  },
})
child.on('exit', (code) => process.exit(code ?? 1))
