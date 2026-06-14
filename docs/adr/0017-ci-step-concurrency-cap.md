---
status: accepted
date: 2026-06-14
---
# ADR 0017: `pnpm verify` Caps Concurrency at 3 — Heavy Test Steps Run Sequentially, Not All-At-Once

## Context

`pnpm verify` (`scripts/ci.mjs`) is the full quality gate: typecheck, lint, build,
unit+coverage, integration, smoke, e2e, visual. A recurring instinct — "it's slow and
the deploy is critical, so spawn every step in parallel to finish faster" — keeps coming
up. This ADR records why we deliberately do **not** do that, so it isn't re-litigated.

The steps are not equal in what they consume:

- **typecheck, lint** — CPU-bound, no test runtime, cheap.
- **build** (`next build --turbopack`) — CPU-heavy, long pole (~65–130s), but not a test
  process.
- **unit + 95% coverage** — vitest node pool with internal worker threads + v8
  instrumentation. **Already parallel inside itself**, and already saturates cores.
- **integration** — vitest **workers pool** (miniflare/workerd), a real worker
  out-of-process against D1/KV/R2.
- **smoke / e2e** — Playwright booting a Next + wrangler dev server, driving a real
  browser.

The key fact: a single dev machine has a fixed number of cores, and several of these
steps each try to use **all** of them. Stacking them doesn't divide the cores fairly —
it oversubscribes, and every participant gets slower.

## Decision

Cap `pnpm verify` at **≤3 concurrent tasks and ≤3 concurrent test processes**, and only
overlap steps that don't contend:

1. **typecheck runs alone first** as a ~5s fail-fast — no point burning a 2-minute build
   on code that doesn't compile.
2. **Step 2 overlaps the safe trio**: `lint + build + unit+coverage` concurrently. Only
   **one** of the three (unit) is a test process; lint and build are not. The build long
   pole hides under the unit suite, banking ~70s vs sequential.
3. **integration → smoke → e2e run sequentially.** Each is a heavy test process; they are
   never started together.

This matches the project HARD LIMIT (CLAUDE.md): *never more than 3 test processes, never
more than 3 concurrent tasks — no exceptions, even when time is critical.*

## Why not "spawn everything at once"

It was measured. Running integration (workerd) alongside a Playwright smoke run (booting
Next + wrangler) on one machine caused CPU contention that pushed **3 smoke specs past
their 30s timeouts**, triggering retries:

- All-parallel (with the retry storm): **~16 minutes.**
- Sequential integration (~43s) then smoke (~80s): **~2 minutes.**

So the "parallelize to go faster" change makes the **critical path 8× longer**, not
shorter — because wall-clock for oversubscribed CPU-bound work is not `max(steps)`, it's
`sum(steps) × contention + retries`. We also watched a single unrelated 2× load spike tip
a 520ms unit test past its 5s ceiling (a flake fixed by giving that heavy full-page-mount
test explicit headroom); four heavy test processes at once would reproduce that across
dozens of tests, every run.

## Pros (sequential-with-a-capped-overlap, the chosen design)

- **Reliable.** No CPU thrash, so no spurious timeout/retry flakes — green means green.
- **Actually faster on the critical path.** ~2min for the heavy tail vs ~16min when they
  fight. The one safe overlap (build under unit) still banks ~70s.
- **Honest failure isolation.** A failure points at one step, not at "something timed out
  because six things ran at once."
- **Respects the hard cap** without special-casing — the same rule that governs agent
  fan-out governs test processes.
- **Deterministic ports.** smoke (3100/8887) and e2e (3200/8987) use separate ranges, so
  even an accidental external concurrent invocation can't collide.

## Cons (and why they're acceptable)

- **The heavy tail is serial**, so on a machine with spare cores it leaves some idle. We
  accept idle cores over retry storms — measured 2min beats 16min. The safe parallelism
  (step 2) is already taken.
- **Full `verify` is still a few minutes.** Mitigated by fast-loop flags rather than by
  unsafe concurrency: `--quick` (typecheck + lint + unit only), `--no-build` (drop the
  ~65–130s production build). Run the full gate once before shipping, not every save.
- **Sensitive to background load.** A 2× loaded machine slows everything. The fix is to
  run verify on an idle machine, not to add concurrency that makes load worse.

## Alternatives considered

- **All steps parallel** — rejected: measured ~16min with retry storms; breaks the cap.
- **integration ∥ smoke** — rejected: this is the specific pair that produced the 30s
  timeouts.
- **More vitest worker processes / splitting the suite into parallel invocations** —
  rejected: vitest already parallelizes internally; extra process-level fan-out
  oversubscribes cores and runs *slower*, the same finding as the coverage-iteration note
  (parallel vitest processes are slower, not faster).

## Related

- [ADR 0008](./0008-coverage-gate-unit-only.md) — coverage gate is unit-only; integration
  is a behavioral gate. Explains why integration is a separate step at all.
- `scripts/ci.mjs` — the executable form of this decision (step layout + the measured
  comment block this ADR formalizes).
