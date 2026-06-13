#!/usr/bin/env node
/**
 * ShopFlare CI gate — one command, the whole quality bar (the Rails `bin/ci` idea,
 * Next.js-style: `pnpm verify`, or `pnpm run ci`).
 *
 * Step ordering (parallel where safe, sequential where test-process limit demands):
 *
 *   Step 1 — typecheck (alone, fail-fast ~5s before spending CPU on expensive work)
 *
 *   Step 2 — CONCURRENT (max 3, exactly ONE test process among them):
 *     a) lint          — oxlint
 *     b) build         — next build  [skipped with --quick or --no-build]
 *     c) unit+coverage — vitest --project unit --coverage (95% gate)
 *   All three must pass before proceeding.
 *
 *   Step 3 — integration (alone, sequential — second test process; miniflare/workerd
 *             out-of-process pool; v8 coverage can't reach it → unit gate is enough)
 *             [skipped with --quick]
 *
 *   Step 4 — e2e (alone, sequential — third test process; boots its own dynamic-port
 *             dev server; local-only, GitHub CI doesn't call `pnpm verify`)
 *             [skipped with --quick]
 *
 * Hard limits (CLAUDE.md + project rules):
 *   - NEVER run more than ONE vitest/playwright process at a time.
 *   - NEVER run more than 3 concurrent tasks total.
 *   - Coverage gate = unit project only at 95% (see docs/adr/0008).
 *
 * Usage:
 *   pnpm verify              # full gate incl. e2e
 *   pnpm verify --no-build   # skip the (slow) production build
 *   pnpm verify --quick      # typecheck + lint + unit only (fast loop, no e2e)
 */
import { spawn } from 'node:child_process'

const args = new Set(process.argv.slice(2))
const skipBuild = args.has('--no-build')
const quick = args.has('--quick')

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
function run(cmd, argv) {
  return new Promise((resolve, reject) => {
    const start = process.hrtime.bigint()
    const child = spawn(cmd, argv, { stdio: 'inherit', shell: process.platform === 'win32' })
    child.on('error', reject)
    child.on('close', (code) => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6
      if (code === 0) resolve(ms)
      else reject(Object.assign(new Error(`exit ${code}`), { ms }))
    })
  })
}

const fmt = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`)

// Accumulates all step results for the final summary.
const results = []
let failed = null

/** Run a single named step; records result; on failure sets `failed` and throws. */
async function runStep(name, cmd, argv) {
  console.log('\n' + tag(`${C.bold}▶ ${name}${C.reset}`))
  try {
    const ms = await run(cmd, argv)
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
 * Each step is { name, cmd, argv, skip? }.
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
    run(s.cmd, s.argv).then(
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
console.log(tag(`${C.bold}ShopFlare CI${C.reset}${quick ? `  ${C.yellow}(quick)${C.reset}` : ''}`))

try {
  // ── Step 1: typecheck — alone, fail-fast before expensive work ────────────
  await runStep('typecheck', 'pnpm', ['typecheck'])

  // ── Step 2: lint + build + unit+coverage — concurrent ────────────────────
  // Exactly ONE test process (unit+coverage). lint and build are non-test tasks.
  // Max 3 concurrent tasks total (lint + build + unit = 3).
  await runConcurrent([
    { name: 'lint', cmd: 'pnpm', argv: ['lint'] },
    { name: 'build', cmd: 'pnpm', argv: ['build'], skip: quick || skipBuild },
    { name: 'unit + 95% coverage', cmd: 'pnpm', argv: ['test:coverage'] },
  ])

  // ── Step 3: integration — sequential (second test process) ────────────────
  // miniflare/workerd out-of-process pool; must NOT overlap with any vitest run.
  if (!quick) {
    await runStep('integration', 'pnpm', ['test:integration'])
  } else {
    console.log(tag(`${C.dim}skip${C.reset}  integration`))
    results.push({ name: 'integration', status: 'skip' })
  }

  // ── Step 4: e2e — sequential, last (third test process) ──────────────────
  // Boots its own dynamic-port dev server; local-only.
  if (!quick) {
    await runStep('e2e', 'pnpm', ['test:e2e'])
  } else {
    console.log(tag(`${C.dim}skip${C.reset}  e2e`))
    results.push({ name: 'e2e', status: 'skip' })
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
