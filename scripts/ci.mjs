#!/usr/bin/env node
/**
 * ShopFlare CI gate — one command, the whole quality bar (the Rails `bin/ci` idea,
 * Next.js-style: `pnpm verify`, or `pnpm run ci`).
 *
 * Step layout (≤3 concurrent tasks, ≤3 concurrent test processes at all times):
 *
 *   Step 1 — typecheck (alone, fail-fast ~5s before burning CPU on expensive work)
 *
 *   Step 2 — CONCURRENT (max 3, exactly ONE test process among them):
 *     a) lint              — oxlint                      [always]
 *     b) build             — next build --turbopack      [skip: --quick, --no-build]
 *     c) unit + 95% cov    — vitest --project unit       [always]
 *   Lint + build = non-test; unit = 1st test process. Wall-clock: build long-pole
 *   overlaps both lint and the unit suite, saving ~70s vs sequential.
 *
 *   Step 3 — integration (sequential; 2nd test process):
 *     miniflare/workerd pool; v8 can't instrument → unit gate is enough for cov.
 *                                                               [skip: --quick]
 *
 *   Step 4 — smoke (sequential; 3rd test process):
 *     Playwright @smoke specs. Port base 3100 / worker 8887.   [skip: --quick]
 *
 *   Step 5 — e2e (sequential; 1st test process after smoke finishes):
 *     Full suite EXCLUDING @smoke and visual: specs.
 *     Port base 3200 / worker 8987.                             [skip: --quick]
 *
 *   Step 6 — visual (opt-in via --visual; native local runner):
 *     Native pnpm test:visual. Baselines are machine-specific; run
 *     `pnpm test:visual:update` once to regenerate if they're stale.
 *                                                               [skip: unless --visual]
 *
 * Why integration + smoke are NOT concurrent:
 *   Measured: running vitest/workerd (integration) alongside Playwright booting a
 *   Next+wrangler dev server (smoke) on the same machine causes CPU contention.
 *   3 smoke tests hit 30s timeouts → retry cost of ~13 minutes. Sequential
 *   integration (~43s) then smoke (~80s) = ~2min, reliably faster than ~16min
 *   concurrent-with-retries. Port ranges are still separated (3100/8887 vs
 *   3200/8987) so smoke and e2e can't collide if invoked externally in parallel.
 *
 * Hard limits (CLAUDE.md + project rules):
 *   - NEVER run more than 3 test processes (vitest or playwright) concurrently.
 *   - NEVER run more than 3 concurrent tasks total.
 *   - Coverage gate = unit project only at 95% (see docs/adr/0008).
 *
 * Step summary table:
 *   +-------+------------------------------------------+--------------+---------------------------+
 *   | Step  | Tasks                                    | Test procs   | Skip conditions           |
 *   +-------+------------------------------------------+--------------+---------------------------+
 *   | 1     | typecheck                                | 0            | --                        |
 *   | 2     | lint + build + unit+coverage (concurrent)| 1            | build: --quick/--no-build |
 *   | 3     | integration                              | 1            | --quick                   |
 *   | 4     | smoke                                    | 1            | --quick                   |
 *   | 5     | e2e                                      | 1            | --quick                   |
 *   | 6     | visual (native, opt-in)                  | 1            | unless --visual           |
 *   +-------+------------------------------------------+--------------+---------------------------+
 *
 * Usage:
 *   pnpm verify              # full gate (no visual by default)
 *   pnpm verify --visual     # full gate + native local visual
 *   pnpm verify --no-build   # skip the (slow) production build
 *   pnpm verify --quick      # typecheck + lint + unit only (fast loop, no e2e)
 */
import { spawn } from 'node:child_process'

const args = new Set(process.argv.slice(2))
const skipBuild = args.has('--no-build')
const quick = args.has('--quick')
const withVisual = args.has('--visual')

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
}
const tag = (s) => `${C.cyan}${C.bold}[ci]${C.reset} ${s}`

/** Run one command, streaming its output. Resolves to ms elapsed; rejects on non-zero exit. */
function run(cmd, argv, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const start = process.hrtime.bigint()
    const child = spawn(cmd, argv, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: { ...process.env, ...extraEnv },
    })
    child.on('error', reject)
    child.on('close', (code) => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6
      if (code === 0) resolve(ms)
      else reject(Object.assign(new Error(`exit ${code}`), { ms }))
    })
  })
}

const fmt = (ms) => {
  if (ms < 1000) return `${Math.round(ms)}ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)}s`
  // Minutes for the long steps (e2e/smoke) so the summary reads in m s, not 320.0s.
  const m = Math.floor(s / 60)
  return `${m}m${Math.round(s - m * 60)}s`
}

// Accumulates all step results for the final summary.
const results = []
let failed = null

/** Run a single named step; records result; on failure sets `failed` and throws. */
async function runStep(name, cmd, argv, extraEnv = {}) {
  console.log('\n' + tag(`${C.bold}▶ ${name}${C.reset}`))
  try {
    const ms = await run(cmd, argv, extraEnv)
    results.push({ name, status: 'pass', ms })
    console.log(tag(`${C.green}✓ ${name}${C.reset} ${C.dim}(${fmt(ms)})${C.reset}`))
    return ms
  } catch (err) {
    results.push({ name, status: 'fail', ms: err.ms })
    failed = name
    throw err
  }
}

/**
 * Run a group of steps concurrently (all start at once).
 * Each step is { name, cmd, argv, skip?, extraEnv? }.
 * Waits for ALL to finish (or any to fail), then throws if any failed —
 * this gives every concurrent step a chance to print its output before we bail.
 */
async function runConcurrent(group) {
  const active = group.filter((s) => !s.skip)
  const skipped = group.filter((s) => s.skip)

  for (const s of skipped) {
    console.log(tag(`${C.dim}skip${C.reset}  ${s.name}`))
    results.push({ name: s.name, status: 'skip' })
  }

  if (active.length === 0) return

  console.log(
    '\n' + tag(`${C.bold}▶ concurrent: ${active.map((s) => s.name).join(' + ')}${C.reset}`),
  )

  const promises = active.map((s) =>
    run(s.cmd, s.argv, s.extraEnv ?? {}).then(
      (ms) => ({ name: s.name, status: 'pass', ms }),
      (err) => ({ name: s.name, status: 'fail', ms: err.ms }),
    ),
  )

  const settled = await Promise.all(promises)

  for (const r of settled) {
    results.push(r)
    if (r.status === 'pass') {
      console.log(tag(`${C.green}✓ ${r.name}${C.reset} ${C.dim}(${fmt(r.ms)})${C.reset}`))
    } else {
      console.log(
        tag(
          `${C.red}✗ ${r.name}${C.reset}${r.ms != null ? ` ${C.dim}(${fmt(r.ms)})${C.reset}` : ''}`,
        ),
      )
      if (!failed) failed = r.name
    }
  }

  if (failed) throw new Error(`concurrent group failed at: ${failed}`)
}

// ── Summary printer ───────────────────────────────────────────────────────────
function printSummary() {
  console.log('\n' + tag(`${C.bold}summary${C.reset}`))
  for (const r of results) {
    const mark =
      r.status === 'pass'
        ? `${C.green}✓${C.reset}`
        : r.status === 'fail'
          ? `${C.red}✗${C.reset}`
          : `${C.dim}–${C.reset}`
    const time = r.ms != null ? ` ${C.dim}${fmt(r.ms)}${C.reset}` : ''
    console.log(`  ${mark} ${r.name}${time}`)
  }
}

// ── Pipeline ──────────────────────────────────────────────────────────────────
console.log(
  tag(
    `${C.bold}ShopFlare CI${C.reset}` +
      (quick ? `  ${C.yellow}(quick)${C.reset}` : '') +
      (withVisual ? `  ${C.cyan}(+visual)${C.reset}` : ''),
  ),
)

try {
  // ── Step 1: typecheck — alone, fail-fast before expensive work ────────────
  await runStep('typecheck', 'pnpm', ['typecheck'])

  // ── Step 2: lint + build + unit+coverage — concurrent ────────────────────
  // 1 test process (unit+coverage). lint and build are non-test.
  // Max 3 concurrent tasks: lint + build + unit = 3.
  // Saves ~70s vs sequential by overlapping the build long-pole with unit.
  await runConcurrent([
    { name: 'lint', cmd: 'pnpm', argv: ['lint'] },
    { name: 'build', cmd: 'pnpm', argv: ['build'], skip: quick || skipBuild },
    { name: 'unit + 95% coverage', cmd: 'pnpm', argv: ['test:coverage'] },
  ])

  // ── Step 3: integration — sequential (2nd test process) ──────────────────
  // miniflare/workerd out-of-process pool; must NOT overlap with any vitest run
  // or a concurrent Playwright dev-server boot (CPU contention causes timeouts).
  if (!quick) {
    await runStep('integration', 'pnpm', ['test:integration'])
  } else {
    console.log(tag(`${C.dim}skip${C.reset}  integration`))
    results.push({ name: 'integration', status: 'skip' })
  }

  // ── Step 4: smoke — sequential (3rd test process, after integration) ──────
  // Playwright @smoke specs only; boots dev server on port base 3100/8887.
  // Runs AFTER integration to avoid CPU contention (measured: concurrent caused
  // 3 timeouts → ~13min retry cost; sequential integration+smoke = ~2min).
  if (!quick) {
    await runStep('smoke', 'node', ['scripts/e2e.mjs', '--grep', '@smoke'], {
      E2E_APP_PORT_BASE: '3100',
      E2E_WORKER_PORT_BASE: '8887',
    })
  } else {
    console.log(tag(`${C.dim}skip${C.reset}  smoke`))
    results.push({ name: 'smoke', status: 'skip' })
  }

  // ── Step 5: e2e — sequential, excludes @smoke + visual: ──────────────────
  // Full suite EXCLUDING @smoke (run above) and visual: specs.
  // Boots its own dev server on port base 3200/8987 (non-overlapping with smoke
  // range 3100/8887 so the two are safe if ever invoked concurrently externally).
  if (!quick) {
    await runStep(
      'e2e',
      'node',
      ['scripts/e2e.mjs', '--project=chromium-desktop', '--grep-invert', 'visual:|@smoke'],
      { E2E_APP_PORT_BASE: '3200', E2E_WORKER_PORT_BASE: '8987' },
    )
  } else {
    console.log(tag(`${C.dim}skip${C.reset}  e2e`))
    results.push({ name: 'e2e', status: 'skip' })
  }

  // ── Step 6: visual — opt-in only (--visual flag), native local runner ─────
  // Uses pnpm test:visual (native). Baselines are machine-specific;
  // regenerate with `pnpm test:visual:update`.
  // Skipped by default — pass --visual to include it.
  if (withVisual) {
    await runStep('visual', 'pnpm', ['test:visual'])
  } else {
    console.log(tag(`${C.dim}skip${C.reset}  visual  ${C.dim}(pass --visual to enable)${C.reset}`))
    results.push({ name: 'visual', status: 'skip' })
  }
} catch {
  // Error already recorded in results; fall through to summary + exit.
}

// ── Summary ───────────────────────────────────────────────────────────────────
printSummary()

if (failed) {
  console.log('\n' + tag(`${C.red}${C.bold}FAILED${C.reset} at: ${failed}`))
  process.exit(1)
}
console.log('\n' + tag(`${C.green}${C.bold}ALL GREEN${C.reset} ✨`))
