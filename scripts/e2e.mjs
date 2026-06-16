#!/usr/bin/env node
// e2e launcher. Finds free ports (scanning up from a configurable base) and
// exports them as PW_PORT / PW_WORKER_PORT before spawning Playwright, so the
// config AND every Playwright worker process share the same ports. Doing the
// scan inside playwright.config.ts instead is unreliable: Playwright re-loads
// the config in each worker, so every worker would pick a *different* free port
// than the one the dev server actually booted on.
//
// Race-safe for concurrent invocations (e.g. smoke + e2e running in parallel):
//   Set E2E_APP_PORT_BASE / E2E_WORKER_PORT_BASE to non-overlapping ranges so
//   the two processes scan distinct 100-port windows and never race on the same
//   candidate. ci.mjs sets:
//     smoke → app 3100–3199 / worker 8887–8986
//     e2e   → app 3200–3299 / worker 8987–9086
//   (Default fallback is 3000 / 8787 for standalone runs.)
//
// Any args are passed through to Playwright:
//   node scripts/e2e.mjs --project=chromium-desktop
//   node scripts/e2e.mjs --grep @smoke
import net from 'node:net'
import { spawn, spawnSync } from 'node:child_process'

// Attempt to bind a TCP server on `candidate`; resolve with `candidate` if free,
// reject (EADDRINUSE) if occupied. Caller increments and retries.
function probePort(candidate) {
  return new Promise((resolve, reject) => {
    const s = net.createServer()
    s.once('error', reject)
    s.once('listening', () => s.close(() => resolve(candidate)))
    s.listen(candidate, '127.0.0.1')
  })
}

// Scan upward from `start` until we bind-and-release a port successfully.
// Unlike the old impl, on exhaustion we throw rather than returning an occupied
// port — the caller must never receive a port that is already in use.
async function freePort(start, exclude = new Set()) {
  for (let p = start; p <= start + 100; p++) {
    if (exclude.has(p)) continue
    try {
      await probePort(p)
      return p // bind succeeded → port is free
    } catch {
      // EADDRINUSE or similar — try next
    }
  }
  throw new Error(`[e2e] No free port found in range ${start}–${start + 100}`)
}

// Base ports: override via env to get non-overlapping ranges for concurrent runs.
const appBase = Number(process.env.E2E_APP_PORT_BASE ?? 3000)
const workerBase = Number(process.env.E2E_WORKER_PORT_BASE ?? 8787)

// Seed the local D1 so the storefront is never empty during e2e. Both steps are
// idempotent: migrations are a no-op when already applied, and seed.sql uses
// INSERT OR IGNORE / INSERT OR REPLACE so re-runs are safe.
console.log('[e2e] Applying local D1 migrations…')
spawnSync('pnpm', ['db:migrate:local'], { stdio: 'inherit' })
console.log('[e2e] Seeding local D1…')
spawnSync('pnpm', ['db:seed:local'], { stdio: 'inherit' })

// Determine app port: re-validate any pre-set PW_PORT (a stale export may point
// at an occupied port), then scan from appBase if needed.
let port
if (process.env.PW_PORT) {
  const candidate = Number(process.env.PW_PORT)
  try {
    await probePort(candidate)
    port = candidate // pre-set value is genuinely free
  } catch {
    console.warn(`[e2e] PW_PORT=${candidate} is occupied — scanning from ${appBase}…`)
    port = await freePort(appBase)
  }
} else {
  port = await freePort(appBase)
}

// Determine worker port: re-validate any pre-set PW_WORKER_PORT, then scan from
// workerBase (skipping the chosen app port so they can never be equal).
let workerPort
const excludeFromWorker = new Set([port])
if (process.env.PW_WORKER_PORT) {
  const candidate = Number(process.env.PW_WORKER_PORT)
  if (excludeFromWorker.has(candidate)) {
    console.warn(
      `[e2e] PW_WORKER_PORT=${candidate} collides with app port — scanning from ${workerBase}…`,
    )
    workerPort = await freePort(workerBase, excludeFromWorker)
  } else {
    try {
      await probePort(candidate)
      workerPort = candidate
    } catch {
      console.warn(`[e2e] PW_WORKER_PORT=${candidate} is occupied — scanning from ${workerBase}…`)
      workerPort = await freePort(workerBase, excludeFromWorker)
    }
  }
} else {
  workerPort = await freePort(workerBase, excludeFromWorker)
}

console.log(`[e2e] app port: ${port}  worker port: ${workerPort}`)

// Tear down the dev stack Playwright's `webServer` leaves behind. That webServer
// runs `concurrently -k "next dev" "wrangler dev"`, but `wrangler dev` does NOT
// reliably forward termination to its `workerd` child — so workerd orphans on
// every run. In `pnpm verify` the smoke step then the e2e step each leak one,
// which starves the machine (CPU/RAM) and makes later e2e tests time out (the
// suite passes in isolation but fails inside verify). Kill by port AND by the
// repo-scoped workerd signature (workerd's argv carries no port) so each run
// leaves nothing behind. Safe: verify runs integration (its own workerd) before
// smoke/e2e, so no other repo workerd is alive at teardown time.
let cleanedUp = false
function cleanup() {
  if (cleanedUp) return
  cleanedUp = true
  const repo = process.cwd()
  const cmds = [
    `lsof -ti tcp:${port} 2>/dev/null | xargs -r kill -9`,
    `lsof -ti tcp:${workerPort} 2>/dev/null | xargs -r kill -9`,
    `pkill -f "${repo}.*workerd serve" 2>/dev/null`,
  ]
  for (const c of cmds) spawnSync('bash', ['-c', c], { stdio: 'ignore' })
}

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
child.on('exit', (code) => {
  cleanup()
  process.exit(code ?? 1)
})
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    try {
      child.kill(sig)
    } catch {
      /* already gone */
    }
    cleanup()
    process.exit(1)
  })
}
