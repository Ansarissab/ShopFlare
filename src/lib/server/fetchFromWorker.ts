// Typed server-side GET helper — wraps fetch() with worker base URL + cache control.
// Use only in async server components and generateMetadata functions (never in
// 'use client' code — for client fetches use lib/api.ts).

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? ''

export interface FetchOptions {
  /** ISR revalidation in seconds. 0 = no-store. Default: 60. */
  revalidate?: number | false
}

export async function fetchFromWorker<T>(
  path: string,
  opts: FetchOptions = {},
): Promise<T | null> {
  const revalidate = opts.revalidate ?? 60
  const cacheConfig: RequestInit['next'] =
    revalidate === false
      ? { revalidate: 0 }
      : { revalidate }

  try {
    if (!WORKER_URL) throw new Error('NEXT_PUBLIC_WORKER_URL not set')
    const res = await fetch(`${WORKER_URL}${path}`, { next: cacheConfig })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return (await res.json()) as T
  } catch {
    return null
  }
}
