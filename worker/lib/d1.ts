// Number of rows a D1 write affected.
//
// The conditional stock-release and order-cancel guards key on "did exactly one
// row change?" to stay race-safe and non-idempotent-safe. Drizzle's run()/returning
// shape isn't statically the D1 `meta.changes` shape, so the call sites used to
// reach it via `(res as unknown as D1Result).meta?.changes` — a double-cast that
// also depends on the ambient `D1Result` global and hides any shape drift from tsc.
//
// Read it through one narrow structural type instead, in a single tested helper.
export function rowsChanged(res: unknown): number {
  return (res as { meta?: { changes?: number } } | null | undefined)?.meta?.changes ?? 0
}
