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
import fs from 'node:fs'
import path from 'node:path'
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

// ─── Registry helpers (crash-recovery, D — Durable) ──────────────────────────
// Registry dir lives under node_modules/.cache (gitignored). Every launcher
// writes a file keyed by its PID; on startup the reaper deletes entries whose
// launcher is dead and reaps their leaked dev stack.

const REGISTRY_DIR = path.join(process.cwd(), 'node_modules/.cache/e2e-stacks')
const registryFile = path.join(REGISTRY_DIR, `${process.pid}.json`)

/** Is `pid` currently alive? Uses signal 0 (no-op probe). */
function pidAlive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    // ESRCH = process not found → truly dead.
    // EPERM = process exists but owned by another user → alive, do not reap.
    return err.code !== 'ESRCH'
  }
}

/** Write this run's registry entry. Failures are swallowed — never crash the run. */
function registryWrite(port, workerPort) {
  try {
    fs.mkdirSync(REGISTRY_DIR, { recursive: true })
    fs.writeFileSync(
      registryFile,
      JSON.stringify({ launcherPid: process.pid, port, workerPort }),
      'utf8',
    )
  } catch (e) {
    console.warn('[e2e] registry write failed (non-fatal):', e.message)
  }
}

/** Delete this run's registry entry. Failures swallowed. */
function registryDelete() {
  try {
    fs.rmSync(registryFile, { force: true })
  } catch {
    /* ignore */
  }
}

/**
 * Pre-flight reaper: scan the registry dir for entries from dead launchers
 * and reap their leaked dev stacks. Live launchers (concurrent runs on
 * different ports) are skipped entirely — isolation is preserved.
 *
 * Port-reuse guard: if a live entry claims the same port as a dead one,
 * we skip that dead entry's reap to avoid killing a live run's procs.
 */
function preflightReaper() {
  let entries
  try {
    const files = fs.readdirSync(REGISTRY_DIR)
    entries = files
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        try {
          const raw = fs.readFileSync(path.join(REGISTRY_DIR, f), 'utf8')
          return { file: f, ...JSON.parse(raw) }
        } catch {
          return null
        }
      })
      .filter(Boolean)
  } catch {
    return // registry dir doesn't exist yet — nothing to reap
  }

  if (entries.length === 0) return

  // Build a set of ports claimed by LIVE launchers (for port-reuse guard).
  const livePorts = new Set()
  for (const e of entries) {
    if (e.launcherPid !== process.pid && pidAlive(e.launcherPid)) {
      livePorts.add(e.port)
      livePorts.add(e.workerPort)
    }
  }

  for (const e of entries) {
    if (e.launcherPid === process.pid) continue // skip ourselves (shouldn't exist yet)
    if (pidAlive(e.launcherPid)) continue // live concurrent run — skip it

    // Dead launcher: reap its stack, guarded by port-reuse check.
    console.log(
      `[e2e] Reaping leaked stack from dead launcher pid=${e.launcherPid} ` +
        `port=${e.port} workerPort=${e.workerPort}`,
    )

    const cmds = []
    if (!livePorts.has(e.workerPort)) {
      cmds.push(`pkill -f "worker/index.ts --port ${e.workerPort}" 2>/dev/null || true`)
      cmds.push(`lsof -ti tcp:${e.workerPort} 2>/dev/null | xargs -r kill -9 || true`)
    }
    if (!livePorts.has(e.port)) {
      cmds.push(`lsof -ti tcp:${e.port} 2>/dev/null | xargs -r kill -9 || true`)
    }
    for (const c of cmds) spawnSync('bash', ['-c', c], { stdio: 'ignore' })

    // Remove the stale registry file.
    try {
      fs.rmSync(path.join(REGISTRY_DIR, e.file), { force: true })
    } catch {
      /* ignore */
    }
  }
}

// ─── Base ports ───────────────────────────────────────────────────────────────
// Base ports: override via env to get non-overlapping ranges for concurrent runs.
const appBase = Number(process.env.E2E_APP_PORT_BASE ?? 3000)
const workerBase = Number(process.env.E2E_WORKER_PORT_BASE ?? 8787)

// ─── Pre-flight reaper (D — runs before seeding/spawning) ────────────────────
preflightReaper()

// Seed the local D1 so the storefront is never empty during e2e. Both steps are
// idempotent: migrations are a no-op when already applied, and seed.sql uses
// INSERT OR IGNORE / INSERT OR REPLACE so re-runs are safe.
console.log('[e2e] Applying local D1 migrations…')
spawnSync('pnpm', ['db:migrate:local'], { stdio: 'inherit' })
console.log('[e2e] Seeding local D1…')
spawnSync('pnpm', ['db:seed:local'], { stdio: 'inherit' })

// Normalize feature flags to their defaults (both OFF) so e2e is deterministic
// regardless of what a dev has toggled in their local admin. The seed is
// INSERT OR IGNORE and never resets an existing key, so a manual `landingEnabled=true`
// (or blogEnabled) persists in the local D1 and silently breaks the home specs — they
// expect the catalog grid at `/`, but landing-on moves the catalog to `/shop`. Blog is
// re-enabled per-suite by e2e/auth.setup.ts; landing is intentionally left OFF.
console.log('[e2e] Normalizing feature flags (landing/blog OFF) for a deterministic baseline…')
spawnSync(
  'pnpm',
  [
    'exec',
    'wrangler',
    'd1',
    'execute',
    'shopflare-db0',
    '--local',
    '--command',
    "UPDATE store_config SET value = 'false' WHERE key IN ('landingEnabled', 'blogEnabled');",
  ],
  { stdio: 'inherit' },
)

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

// ─── Registry write (D) ───────────────────────────────────────────────────────
// Write registry AFTER ports are known; before spawning the dev stack.
registryWrite(port, workerPort)

// ─── Tear-down (ACID cleanup) ─────────────────────────────────────────────────
// Tear down the dev stack Playwright's `webServer` leaves behind. That webServer
// runs `concurrently -k "next dev" "wrangler dev"`, but `wrangler dev` does NOT
// reliably forward termination to its `workerd` child — so workerd orphans on
// every run. In `pnpm verify` the smoke step then the e2e step each leak one,
// which starves the machine (CPU/RAM) and makes later e2e tests time out (the
// suite passes in isolation but fails inside verify).
//
// Fix: spawn playwright as a process-GROUP leader (detached:true) so concurrently
// → next → wrangler → workerd all share child.pid's group id. cleanup() sends
// SIGKILL to the entire group (-pid) FIRST — this reaps wrangler/workerd even
// if they never bound a port (boot-fail / early-signal scenario). The existing
// by-port and workerd-signature kills are kept as a belt-and-suspenders second
// step for any grandchild that double-forked out of the group.
//
// ACID convergence loop: after initial kills, verify via pgrep/lsof that
// nothing remains; retry up to MAX_CLEANUP_ATTEMPTS times (~250ms apart).
// spawnSync is used throughout so this completes even inside the 'exit' handler.

let child // declared before cleanup() so the closure has no TDZ error
let cleanedUp = false
const MAX_CLEANUP_ATTEMPTS = 4
const CLEANUP_RETRY_DELAY_MS = 250
const repo = process.cwd()

/** Synchronous sleep used inside cleanup() retry loop (safe in exit handler). */
function sleepSync(ms) {
  const start = Date.now()
  while (Date.now() - start < ms) {
    /* busy-wait — only called in cleanup, ms is short (250ms) */
  }
}

/**
 * Returns true if any procs still hold our ports or match our worker signature.
 * Uses pgrep + lsof (both port-scoped to THIS run).
 */
function leaksExist() {
  const workerAlive = spawnSync(
    'bash',
    ['-c', `pgrep -f "worker/index.ts --port ${workerPort}" 2>/dev/null | head -1`],
    { encoding: 'utf8' },
  )
  if (workerAlive.stdout.trim()) return true
  const workerPortAlive = spawnSync(
    'bash',
    ['-c', `lsof -ti tcp:${workerPort} 2>/dev/null | head -1`],
    { encoding: 'utf8' },
  )
  if (workerPortAlive.stdout.trim()) return true
  const appPortAlive = spawnSync('bash', ['-c', `lsof -ti tcp:${port} 2>/dev/null | head -1`], {
    encoding: 'utf8',
  })
  if (appPortAlive.stdout.trim()) return true
  return false
}

/** Issue one round of port-scoped kills. */
function killRound() {
  // Kill the whole process group first (precise to THIS run).
  if (child?.pid) {
    try {
      process.kill(-child.pid, 'SIGKILL')
    } catch {
      /* group already gone */
    }
  }
  const cmds = [
    `pkill -f "worker/index.ts --port ${workerPort}" 2>/dev/null || true`,
    `lsof -ti tcp:${workerPort} 2>/dev/null | xargs -r kill -9 || true`,
    `lsof -ti tcp:${port} 2>/dev/null | xargs -r kill -9 || true`,
    `pkill -f "${repo}.*workerd serve" 2>/dev/null || true`,
  ]
  for (const c of cmds) spawnSync('bash', ['-c', c], { stdio: 'ignore' })
}

function cleanup() {
  if (cleanedUp) return
  cleanedUp = true

  // ACID convergence loop: kill, verify, retry if leaks persist.
  for (let attempt = 1; attempt <= MAX_CLEANUP_ATTEMPTS; attempt++) {
    killRound()
    if (!leaksExist()) break
    if (attempt < MAX_CLEANUP_ATTEMPTS) {
      console.warn(
        `[e2e] cleanup attempt ${attempt}: leaks remain — retrying in ${CLEANUP_RETRY_DELAY_MS}ms…`,
      )
      sleepSync(CLEANUP_RETRY_DELAY_MS)
    } else {
      console.warn(`[e2e] cleanup: leaks may remain after ${MAX_CLEANUP_ATTEMPTS} attempts`)
    }
  }

  // D: delete this run's registry entry so the dir is empty after clean runs.
  registryDelete()
}

child = spawn('./node_modules/.bin/playwright', ['test', ...process.argv.slice(2)], {
  stdio: 'inherit',
  detached: true, // makes child a process-group leader; group id == child.pid
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
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    // Signal the whole process group, not just the direct child
    if (child?.pid) {
      try {
        process.kill(-child.pid, sig)
      } catch {
        /* already gone */
      }
    }
    cleanup()
    process.exit(1)
  })
}
// C — Consistent: catch all remaining exit paths.
process.on('uncaughtException', (err) => {
  console.error('[e2e] uncaughtException:', err)
  cleanup()
  process.exit(1)
})
process.on('unhandledRejection', (reason) => {
  console.error('[e2e] unhandledRejection:', reason)
  cleanup()
  process.exit(1)
})
// Sync exit handler as a final safety net (e.g. process.exit() called directly).
process.on('exit', cleanup)
