#!/usr/bin/env node
// Prod-deploy preflight: enforce dev/prod env isolation BEFORE the frontend build.
//
// The trap this guards against: Next.js loads `.env.local` in EVERY environment
// and it OVERRIDES `.env.production`. So a `NEXT_PUBLIC_*` left in `.env.local`
// for local dev silently poisons the production build (e.g. baking
// `http://localhost:8787` as the API URL -> deployed site can't fetch).
//
// Rules enforced (fails the deploy, prints NO secret values):
//   1. `.env.production` exists and defines the required NEXT_PUBLIC_* keys.
//   2. NEXT_PUBLIC_WORKER_URL / SITE_URL are real https origins (not localhost/http).
//   3. `.env.local` contains NO NEXT_PUBLIC_* keys (they would override prod).
//      Put dev-only overrides in `.env.development.local` instead (dev-only load).
//
// Run by `pnpm web:deploy` before the build.
import { existsSync, readFileSync } from 'node:fs'

const REQUIRED = [
  'NEXT_PUBLIC_WORKER_URL',
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
]
const fail = (msg) => {
  console.error(`\n✘ prod preflight failed: ${msg}\n`)
  process.exit(1)
}

// Minimal KEY=VALUE parser (ignores comments/blank lines); returns key->value.
function parseEnv(path) {
  if (!existsSync(path)) return null
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    out[t.slice(0, eq).trim()] = t
      .slice(eq + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '')
  }
  return out
}

const prod = parseEnv('.env.production')
if (!prod)
  fail(
    '.env.production is missing. Copy .env.production.example and fill in your deployed URLs + Turnstile site key.',
  )

for (const k of REQUIRED) {
  if (!prod[k]) fail(`.env.production is missing ${k}.`)
}
for (const k of ['NEXT_PUBLIC_WORKER_URL', 'NEXT_PUBLIC_SITE_URL']) {
  const v = prod[k]
  if (/localhost|127\.0\.0\.1/.test(v))
    fail(`${k} points at localhost in .env.production — set it to your deployed origin.`)
  if (!/^https:\/\//.test(v)) fail(`${k} must be an https:// origin in .env.production.`)
}

// .env.local must not carry NEXT_PUBLIC_* (it overrides .env.production at build).
const local = parseEnv('.env.local')
if (local) {
  const leaking = Object.keys(local).filter((k) => k.startsWith('NEXT_PUBLIC_'))
  if (leaking.length) {
    fail(
      `.env.local defines ${leaking.join(', ')} — these OVERRIDE .env.production in the build.\n` +
        `   Move dev-only overrides to .env.development.local (loaded only in dev), keep .env.local free of NEXT_PUBLIC_* keys.`,
    )
  }
}

console.log(
  '✓ prod env isolation OK (.env.production complete, no .env.local NEXT_PUBLIC_* overrides)',
)
