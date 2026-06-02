// Cheap ETag fingerprinting for public read endpoints.
// ETag changes whenever count, max updated_at, or the global data version changes
// so even deletes (which don't update surviving rows) invalidate correctly.

export interface FingerprintInput {
  count: number
  maxUpdatedAt: string
  version?: number | string
}

// Returns a weak ETag suitable for the ETag response header.
// btoa-encoded so it's a legal header value with no quoting issues.
export function etagFor(input: FingerprintInput): string {
  const raw = `${input.count}:${input.maxUpdatedAt}:${input.version ?? ''}`
  return `W/"${btoa(raw)}"`
}
