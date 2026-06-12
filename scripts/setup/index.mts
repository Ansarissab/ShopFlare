/**
 * ShopFlare — interactive setup wizard.
 *
 * Automates initial deployment: CF login → migrate + seed → worker secrets →
 * Stripe webhook auto-create → deploy both workers → write .env.local.
 *
 * Requires wrangler ≥ 4.45.0 (auto-provisions D1/KV/R2 on first deploy).
 * Run via `pnpm setup`. Plain TS (type annotations only) so Node's built-in
 * type stripping runs it with no extra dependency. ESM (.mts) because
 * @clack/prompts is ESM-only and the repo defaults to CommonJS.
 */
import { spawnSync } from 'node:child_process'
import { writeFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  intro,
  outro,
  text,
  password,
  confirm,
  isCancel,
  cancel,
  spinner,
  note,
  log,
} from '@clack/prompts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const ENV_LOCAL = resolve(ROOT, '.env.local')
// NEXT_PUBLIC_* vars must NOT go in .env.local — that overrides next dev and
// leaks the prod URL into local development. Write them to .env.production so
// they are only active during `next build` / `web:deploy`.
const ENV_PRODUCTION = resolve(ROOT, '.env.production')

// ── shell helpers ──────────────────────────────────────────────────────────

/** Run a command, capturing stdout. Throws on non-zero exit. */
function capture(cmd: string, args: string[], stdin?: string): string {
  const res = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    input: stdin,
  })
  if (res.status !== 0) {
    throw new Error(
      `\`${cmd} ${args.join(' ')}\` failed (exit ${res.status}):\n` +
        `${res.stderr || res.stdout || res.error?.message || ''}`,
    )
  }
  return res.stdout ?? ''
}

/** Run a command with inherited stdio (user sees live output). */
function runLive(cmd: string, args: string[], stdin?: string): boolean {
  const res = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: stdin === undefined ? 'inherit' : ['pipe', 'inherit', 'inherit'],
    input: stdin,
  })
  return res.status === 0
}

/** True if a command exists and exits 0 for the given probe args. */
function probe(cmd: string, args: string[]): boolean {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8' })
  return res.status === 0
}

/** Abort the wizard cleanly when the user hits Ctrl-C / Esc. */
function guard<T>(value: T | symbol): T {
  if (isCancel(value)) {
    cancel('Setup cancelled. Re-run `pnpm setup` any time.')
    process.exit(0)
  }
  return value as T
}

/** Parse wrangler version string into [major, minor, patch]. */
function parseWranglerVersion(): [number, number, number] | null {
  try {
    const out = capture('npx', ['wrangler', '--version'])
    const m = out.match(/(\d+)\.(\d+)\.(\d+)/)
    if (!m) return null
    return [Number(m[1]), Number(m[2]), Number(m[3])]
  } catch {
    return null
  }
}

// ── secret + env definitions ────────────────────────────────────────────────

type SecretSpec = {
  name: string
  label: string
  masked: boolean
  required: boolean
  hint?: string
}

// Worker secrets — mirrors the Bindings type in worker/types.ts.
// STRIPE_WEBHOOK_SECRET is auto-derived after deploy; not listed here.
const SECRETS: SecretSpec[] = [
  { name: 'STRIPE_SECRET_KEY', label: 'Stripe secret key (sk_…)', masked: true, required: true },
  {
    name: 'STRIPE_PUBLISHABLE_KEY',
    label: 'Stripe publishable key (pk_…)',
    masked: false,
    required: true,
  },
  { name: 'RESEND_API_KEY', label: 'Resend API key (re_…)', masked: true, required: true },
  {
    name: 'VAPID_PUBLIC_KEY',
    label: 'Web Push VAPID public key',
    masked: false,
    required: false,
    hint: 'Generate with: npx web-push generate-vapid-keys',
  },
  { name: 'VAPID_PRIVATE_KEY', label: 'Web Push VAPID private key', masked: true, required: false },
  { name: 'TURNSTILE_SITE_KEY', label: 'Turnstile site key (0x…)', masked: false, required: true },
  { name: 'TURNSTILE_SECRET_KEY', label: 'Turnstile secret key', masked: true, required: true },
  { name: 'ADMIN_PASSWORD', label: 'Admin password (your login)', masked: true, required: true },
  {
    name: 'ADMIN_SESSION_SECRET',
    label: 'Admin session secret (openssl rand -hex 32)',
    masked: true,
    required: true,
  },
]

// ── wizard ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  intro('ShopFlare — setup wizard')
  note(
    'Handles: CF login → D1/KV/R2 auto-provision → DB migrate+seed →\n' +
      'secrets → Stripe webhook → both worker deploys → .env.local.\n\n' +
      'Nothing is changed until each step asks you to confirm.',
    'What this does',
  )

  // 1 ── Prerequisites ───────────────────────────────────────────────────────
  const major = Number(process.versions.node.split('.')[0])
  if (major < 22) {
    log.error(`Node ${process.versions.node} detected — Node 22+ required.`)
    process.exit(1)
  }

  const ver = parseWranglerVersion()
  if (!ver) {
    log.error('wrangler not available. Run `pnpm install` first.')
    process.exit(1)
  }
  const [wMajor, wMinor] = ver
  const autoProvision = wMajor > 4 || (wMajor === 4 && wMinor >= 45)
  if (!autoProvision) {
    log.warn(
      `wrangler ${ver.join('.')} detected — auto-provisioning requires ≥ 4.45.0.\n` +
        'Create D1/KV/R2 manually and re-link ids before deploying, or run:\n' +
        '  pnpm up wrangler --latest',
    )
  }
  log.success(`Node ${process.versions.node} + wrangler ${ver.join('.')} ready.`)

  // 2 ── Cloudflare auth ─────────────────────────────────────────────────────
  if (!probe('npx', ['wrangler', 'whoami'])) {
    const doLogin = guard(await confirm({ message: 'Not logged in to Cloudflare. Log in now?' }))
    if (!doLogin) {
      log.warn('Cloudflare login required. Re-run after `npx wrangler login`.')
      process.exit(0)
    }
    if (!runLive('npx', ['wrangler', 'login'])) {
      log.error('Login failed.')
      process.exit(1)
    }
  }
  log.success('Cloudflare account authenticated.')

  // 3 ── Migrate + seed remote D1 ────────────────────────────────────────────
  // D1/KV are auto-provisioned on first wrangler deploy (Step 6).
  // R2 must exist before deploy; create it if needed.
  const createR2 = guard(
    await confirm({ message: 'Create R2 bucket `shopflare-images0`? (skip if it already exists)' }),
  )
  if (createR2) {
    const s = spinner()
    s.start('Creating R2 bucket `shopflare-images0`')
    try {
      capture('npx', ['wrangler', 'r2', 'bucket', 'create', 'shopflare-images0'])
      s.stop('R2 bucket ready.')
    } catch (e) {
      s.stop('R2 step skipped (may already exist).')
      log.warn((e as Error).message)
    }
  }

  const migrate = guard(
    await confirm({ message: 'Apply migrations and seed defaults to remote D1?' }),
  )
  if (migrate) {
    log.step('Applying migrations…')
    runLive('pnpm', ['db:migrate'])
    log.step('Seeding store_config defaults…')
    runLive('pnpm', ['db:seed'])
    log.success('Database ready.')
  }

  // 4 ── Worker secrets ──────────────────────────────────────────────────────
  const setSecrets = guard(await confirm({ message: 'Set worker secrets now?' }))
  let stripeSecretKey = ''
  let turnstileSiteKey = ''
  if (setSecrets) {
    for (const spec of SECRETS) {
      if (spec.hint) log.info(spec.hint)
      const value = guard(
        spec.masked
          ? await password({ message: spec.label })
          : await text({
              message: spec.label,
              placeholder: spec.required ? 'required' : 'leave blank to skip',
            }),
      )
      const v = (value ?? '').trim()
      if (!v) {
        if (spec.required)
          log.warn(
            `${spec.name} left blank — set later via \`npx wrangler secret put ${spec.name}\`.`,
          )
        continue
      }
      if (spec.name === 'STRIPE_SECRET_KEY') stripeSecretKey = v
      if (spec.name === 'TURNSTILE_SITE_KEY') turnstileSiteKey = v
      const ok = runLive('npx', ['wrangler', 'secret', 'put', spec.name], v + '\n')
      if (ok) log.success(`${spec.name} set.`)
      else log.warn(`${spec.name} failed — retry with \`npx wrangler secret put ${spec.name}\`.`)
    }
  }

  // 5 ── Deploy API worker ───────────────────────────────────────────────────
  // D1 and KV are auto-provisioned here on first deploy (wrangler ≥ 4.45.0).
  let workerUrl = ''
  const deploy = guard(
    await confirm({
      message: 'Deploy the API worker now? (auto-provisions D1 + KV on first deploy)',
    }),
  )
  if (deploy) {
    const s = spinner()
    s.start('Deploying API worker (ENVIRONMENT=production)')
    try {
      const out = capture('pnpm', ['worker:deploy'])
      workerUrl = out.match(/https:\/\/[^\s]+\.workers\.dev/)?.[0] ?? ''
      s.stop(workerUrl ? `API worker deployed → ${workerUrl}` : 'API worker deployed.')
    } catch (e) {
      s.stop('Deploy failed.')
      log.warn((e as Error).message)
    }
  }
  if (!workerUrl) {
    workerUrl = (
      guard(
        await text({
          message: 'API worker URL (NEXT_PUBLIC_WORKER_URL)',
          placeholder: 'https://shopflare-worker.YOUR.workers.dev',
        }),
      ) ?? ''
    ).trim()
  }

  // 6 ── Auto-create Stripe webhook ──────────────────────────────────────────
  // Requires STRIPE_SECRET_KEY + API worker URL. Falls back to manual if anything fails.
  if (stripeSecretKey && workerUrl) {
    const webhookUrl = `${workerUrl}/api/stripe/webhook`
    const createWebhook = guard(
      await confirm({ message: `Auto-create Stripe webhook at ${webhookUrl}?` }),
    )
    if (createWebhook) {
      const s = spinner()
      s.start('Creating Stripe webhook endpoint…')
      try {
        // Check for existing endpoint first (idempotency)
        const listRes = await fetch('https://api.stripe.com/v1/webhook_endpoints?limit=100', {
          headers: { Authorization: `Bearer ${stripeSecretKey}` },
        })
        if (!listRes.ok) throw new Error(`Stripe list webhooks failed: ${listRes.status}`)
        const listData = (await listRes.json()) as { data: Array<{ url: string; id: string }> }
        const existing = listData.data.find((ep) => ep.url === webhookUrl)

        if (existing) {
          s.stop(
            `Endpoint already exists (id: ${existing.id}). Signing secret only shown at creation time.`,
          )
          log.warn(
            'To get STRIPE_WEBHOOK_SECRET: Stripe Dashboard → Webhooks → this endpoint → reveal signing secret.',
          )
          log.warn('Then: npx wrangler secret put STRIPE_WEBHOOK_SECRET')
        } else {
          const webhookParams = new URLSearchParams()
          webhookParams.append('url', webhookUrl)
          webhookParams.append('enabled_events[]', 'checkout.session.completed')
          webhookParams.append('enabled_events[]', 'checkout.session.expired')
          webhookParams.append('enabled_events[]', 'payment_intent.payment_failed')
          const createRes = await fetch('https://api.stripe.com/v1/webhook_endpoints', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${stripeSecretKey}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: webhookParams.toString(),
          })
          if (!createRes.ok) {
            const errBody = await createRes.text()
            throw new Error(`Stripe create webhook failed: ${createRes.status} — ${errBody}`)
          }
          const created = (await createRes.json()) as { secret: string; id: string }
          s.stop(`Stripe webhook created (id: ${created.id}).`)

          // Pipe secret straight to wrangler — never log it
          const ok = runLive(
            'npx',
            ['wrangler', 'secret', 'put', 'STRIPE_WEBHOOK_SECRET'],
            created.secret + '\n',
          )
          if (ok) log.success('STRIPE_WEBHOOK_SECRET set.')
          else
            log.warn(
              'STRIPE_WEBHOOK_SECRET wrangler put failed — set manually via `npx wrangler secret put STRIPE_WEBHOOK_SECRET`.',
            )
        }
      } catch (e) {
        s.stop('Stripe webhook step failed — falling back to manual.')
        log.warn((e as Error).message)
        log.warn(
          'Manual fallback:\n' +
            '  1. Stripe Dashboard → Developers → Webhooks → Add endpoint\n' +
            `  2. URL: ${webhookUrl}\n` +
            '  3. Events: checkout.session.completed, checkout.session.expired, payment_intent.payment_failed\n' +
            '  4. npx wrangler secret put STRIPE_WEBHOOK_SECRET',
        )
      }
    }
  } else if (!stripeSecretKey) {
    log.info(
      'STRIPE_SECRET_KEY not set — skipping Stripe webhook auto-create. Set it later and re-run or configure manually.',
    )
  }

  // 7 ── FRONTEND_URL secret (CORS + Stripe redirects) ───────────────────────
  const frontendUrl = (
    guard(
      await text({
        message: 'Frontend worker URL for FRONTEND_URL secret (set after web:deploy if unknown)',
        placeholder: 'https://shopflare-web.YOUR.workers.dev',
      }),
    ) ?? ''
  ).trim()
  if (frontendUrl) {
    if (runLive('npx', ['wrangler', 'secret', 'put', 'FRONTEND_URL'], frontendUrl + '\n')) {
      log.success('FRONTEND_URL set.')
    }
  }

  // 8 ── Write env files ─────────────────────────────────────────────────────
  // .env.production  — NEXT_PUBLIC_* (prod URLs for build/deploy only)
  // .env.local       — NEXT_PUBLIC_TURNSTILE_SITE_KEY (safe for local dev too)
  //
  // Keeping NEXT_PUBLIC_WORKER_URL and NEXT_PUBLIC_SITE_URL out of .env.local
  // prevents the prod worker URL from leaking into `next dev` and local e2e.
  const siteUrl = frontendUrl || workerUrl
  const writeEnvProd = !existsSync(ENV_PRODUCTION)
    ? true
    : guard(await confirm({ message: '.env.production exists — overwrite?' }))
  if (writeEnvProd) {
    const envProd =
      `# Generated by \`pnpm setup\`. Used by next build / web:deploy only.\n` +
      `NEXT_PUBLIC_WORKER_URL=${workerUrl}\n` +
      `NEXT_PUBLIC_SITE_URL=${siteUrl}\n`
    writeFileSync(ENV_PRODUCTION, envProd)
    log.success('.env.production written.')
  }

  const writeEnv = !existsSync(ENV_LOCAL)
    ? true
    : guard(await confirm({ message: '.env.local exists — overwrite?' }))
  if (writeEnv) {
    const env =
      `# Generated by \`pnpm setup\`. Safe to edit.\n` +
      `NEXT_PUBLIC_TURNSTILE_SITE_KEY=${turnstileSiteKey}\n`
    writeFileSync(ENV_LOCAL, env)
    log.success('.env.local written.')
  }

  // 9 ── Deploy frontend worker ──────────────────────────────────────────────
  const deployFrontend = guard(
    await confirm({ message: 'Deploy the frontend (storefront) worker now? (pnpm web:deploy)' }),
  )
  if (deployFrontend) {
    log.step('Building + deploying frontend worker…')
    runLive('pnpm', ['web:deploy'])
  }

  // 10 ── Post-deploy smoke check ────────────────────────────────────────────
  if (workerUrl) {
    const s = spinner()
    s.start(`Smoke check: GET ${workerUrl}/api/ping`)
    try {
      const res = await fetch(`${workerUrl}/api/ping`)
      const body = (await res.json()) as { ok?: boolean }
      if (res.ok && body?.ok === true) {
        s.stop('API worker is live and healthy.')
      } else {
        s.stop(`Smoke check returned unexpected response (status ${res.status}).`)
        log.warn(`Response: ${JSON.stringify(body)}`)
      }
    } catch (e) {
      s.stop('Smoke check failed — worker may still be propagating.')
      log.warn((e as Error).message)
    }
  }

  // 11 ── Remaining manual steps ─────────────────────────────────────────────
  note(
    [
      'Manual steps remaining:',
      '',
      '1. Set CF budget alert: Dashboard → Manage Account → Billing →',
      '   Billable Usage → Set Budget Alert (e.g. $1).',
      '2. (Optional) Add a custom domain: Workers → each worker →',
      '   Settings → Domains & Routes.',
      '',
      'Full details: docs/setup/cloudflare-guide.md',
      '',
      'Admin login: <your-frontend-url>/admin → enter ADMIN_PASSWORD.',
      'Bearer auth: admin sessions use Authorization: Bearer — no CF Access needed.',
    ].join('\n'),
    'Finish in the dashboard',
  )

  outro('Setup complete. Run `pnpm dev` + `pnpm worker:dev` to develop locally.')
}

main().catch((err) => {
  log.error((err as Error).message)
  process.exit(1)
})
