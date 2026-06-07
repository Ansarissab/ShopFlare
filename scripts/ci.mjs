#!/usr/bin/env node
/**
 * ShopFlare CI gate — one command, the whole quality bar (the Rails `bin/ci` idea,
 * Next.js-style: `pnpm verify`, or `pnpm run ci`).
 *
 * Runs every gate the way it would run in cloud CI, fail-fast, with a clean summary.
 * Steps (in order):
 *   1. typecheck   — tsc x3 (app + worker + service worker)
 *   2. lint        — eslint (0 errors)
 *   3. unit + cov  — vitest unit project with the 95% coverage gate
 *   4. integration — vitest workers-pool suite (real worker + D1/KV/R2 via miniflare)
 *   5. build       — next build
 *
 * E2E/visual/a11y (Playwright) are intentionally NOT here — they need a running dev
 * server + Chromium and are slow. Run them with `pnpm test:e2e` (or `pnpm test:all`).
 *
 * Usage:
 *   pnpm verify              # run the full gate
 *   pnpm verify --no-build   # skip the (slow) production build
 *   pnpm verify --quick      # typecheck + lint + unit only (fast pre-commit-ish loop)
 */
import { spawn } from 'node:child_process'

const args = new Set(process.argv.slice(2))
const skipBuild = args.has('--no-build')
const quick = args.has('--quick')

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', cyan: '\x1b[36m',
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

const steps = [
  { name: 'typecheck',   cmd: 'pnpm', argv: ['typecheck'] },
  { name: 'lint',        cmd: 'pnpm', argv: ['lint'] },
  { name: 'unit + 95% coverage', cmd: 'pnpm', argv: ['test:coverage'] },
  { name: 'integration', cmd: 'pnpm', argv: ['test:integration'], skip: quick },
  { name: 'build',       cmd: 'pnpm', argv: ['build'], skip: quick || skipBuild },
]

const fmt = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`)
const results = []
let failed = null

console.log(tag(`${C.bold}ShopFlare CI${C.reset}${quick ? `  ${C.yellow}(quick)${C.reset}` : ''}`))

for (const step of steps) {
  if (step.skip) {
    console.log(tag(`${C.dim}skip${C.reset}  ${step.name}`))
    results.push({ name: step.name, status: 'skip' })
    continue
  }
  console.log('\n' + tag(`${C.bold}▶ ${step.name}${C.reset}`))
  try {
    const ms = await run(step.cmd, step.argv)
    results.push({ name: step.name, status: 'pass', ms })
    console.log(tag(`${C.green}✓ ${step.name}${C.reset} ${C.dim}(${fmt(ms)})${C.reset}`))
  } catch (err) {
    results.push({ name: step.name, status: 'fail', ms: err.ms })
    failed = step.name
    break // fail-fast
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log('\n' + tag(`${C.bold}summary${C.reset}`))
for (const r of results) {
  const mark = r.status === 'pass' ? `${C.green}✓${C.reset}`
    : r.status === 'fail' ? `${C.red}✗${C.reset}`
    : `${C.dim}–${C.reset}`
  const time = r.ms != null ? ` ${C.dim}${fmt(r.ms)}${C.reset}` : ''
  console.log(`  ${mark} ${r.name}${time}`)
}

if (failed) {
  console.log('\n' + tag(`${C.red}${C.bold}FAILED${C.reset} at: ${failed}`))
  process.exit(1)
}
console.log('\n' + tag(`${C.green}${C.bold}ALL GREEN${C.reset} ✨`))
