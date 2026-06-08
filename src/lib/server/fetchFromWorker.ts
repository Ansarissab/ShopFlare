// Typed server-side GET helper — wraps fetch() with worker base URL + cache control.
// Use only in async server components and generateMetadata functions (never in
// 'use client' code — for client fetches use lib/api.ts).

export interface FetchOptions {
  /** ISR revalidation in seconds. 0 = no-store. Default: 60. */
  revalidate?: number | false
}

export async function fetchFromWorker<T>(
  path: string,
  opts: FetchOptions = {},
): Promise<T | null> {
  // Read lazily so tests can stub NEXT_PUBLIC_WORKER_URL per-call via vi.stubEnv.
  const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL ?? ''
  const revalidate = opts.revalidate ?? 60
  const cacheConfig: RequestInit['next'] =
    revalidate === false
      ? { revalidate: 0 }
      : { revalidate }

  try {
    if (!workerUrl) throw new Error('NEXT_PUBLIC_WORKER_URL not set')
    const res = await fetch(`${workerUrl}${path}`, { next: cacheConfig })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return (await res.json()) as T
  } catch {
    return null
  }
}
