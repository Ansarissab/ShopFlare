---
status: accepted
date: 2026-06-06
---
# ADR 0008: Coverage Gate Is Unit-Only; Integration Covers Worker Routes Behaviorally (Phase 16)

## Context

Phase 16 added a 95% coverage gate. The first naive wiring ran `vitest run --coverage`
across the whole vitest **workspace** — both projects at once:

- `unit` project — node pool, instruments cleanly with v8.
- `integration` project — Cloudflare **workers pool** (miniflare/workerd), runs the real
  worker out-of-process.

That produced a meaningless number (~72%): v8 instruments the **node** process, not the
workerd runtime, so every `worker/routes/*` file reported **0%** despite being exercised
end-to-end by the integration suite — while miniflare's bundled `node_modules` (drizzle,
hono, stripe) leaked into the report at 100% and inflated the denominator. The gate could
never pass and the signal was noise.

## Decision

The 95% line/function/branch/statement gate is enforced on the **`unit` project only**,
with an explicit `include` scope. Coverage is removed from the integration config entirely.

1. **Gate = unit project.** `pnpm test:coverage` → `vitest run --project unit --coverage`.
   `all: true` + `include: ['src/**', 'worker/lib/**']` so the gate measures the real
   unit-testable surface, not just files a test happens to import.

2. **Integration suite is a behavioral gate, not a coverage one.** `pnpm test:integration`
   → `vitest run --project integration`. Its job is "every worker route exercised via
   `SELF.fetch` against real D1/KV/R2", asserted by the tests themselves — not line %.

3. **Excluded from the unit gate** (covered elsewhere or not unit-instrumentable):
   - `src/app/**`, `src/middleware.ts`, `src/proxy.ts` — Next edge/server code, E2E-tested.
   - `src/components/ui/**` — vendored shadcn primitives.
   - `worker/lib/{orders,stripe,push,analytics,access,categories,notify,products}.ts` —
     these wrap D1/KV/R2/Stripe/Resend and external IO; exercised by the integration
     suite. Unit-testing them would mean mocking away their entire body. The pure helpers
     (`money`, `version`, `ratelimit`, `access-core`, `email`, `edge-cache`, `http`,
     `fingerprint`, `turnstile`) stay in scope and are unit-tested.

4. **One command for the whole bar.** `pnpm ci` (`scripts/ci.mjs`) runs, fail-fast:
   typecheck → lint → unit+coverage → integration → build. Flags: `--quick` (skip
   integration+build), `--no-build`.

## Supersedes

Refines the Phase 16 plan (`docs/plans/done/phase-16-comprehensive-testing.md` §5.1, §10),
which described a single whole-codebase `vitest run --coverage` gate.

## Tradeoffs

- Worker route line-coverage is **not** in the headline number. Mitigated: routes are
  integration-tested behaviorally, which catches more (routing, middleware, DB writes,
  stock/coupon logic) than line coverage would. Reviewers must keep route tests current.
- Excluding the CF-runtime `worker/lib/*` files means a regression there shows up in the
  integration suite, not the unit gate — slower feedback, but honest (those files can't be
  meaningfully unit-tested without gutting them into mocks).
- `all: true` keeps untested in-scope files visible (counted at 0%), so coverage can't be
  gamed by simply not importing a file.
