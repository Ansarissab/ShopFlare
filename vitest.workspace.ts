// Two test projects:
//   - unit         (node pool)    — pure-logic tests, fast
//   - integration  (workers pool) — real worker + D1/KV/R2 via miniflare
// `pnpm test` runs both.
export default ['./vitest.config.ts', './vitest.integration.config.ts']
