// Global API client — the single source of truth for talking to the CF Worker.
//
// DRY rule: never write `const WORKER_URL = process.env...` + raw `fetch()` in a
// component or page. Import `apiGet` / `apiPost` from here. Base URL, JSON
// headers, and non-2xx handling live in ONE place.
//
// 404 / status-specific handling: catch `ApiError` and inspect `.status`.

export const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? ''

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Per-call options. `headers` merges over the defaults (e.g. an
// `X-Turnstile-Token` on protected POSTs) so callers never reach for raw fetch.
export type ApiOptions = { headers?: Record<string, string> }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  if (!res.ok) {
    throw new ApiError(res.status, `HTTP ${res.status}`)
  }

  // Tolerate empty bodies (e.g. 204) without throwing on JSON.parse.
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export function apiGet<T>(path: string, opts?: ApiOptions): Promise<T> {
  return request<T>(path, { headers: opts?.headers })
}

export function apiPost<T>(path: string, body?: unknown, opts?: ApiOptions): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: opts?.headers,
  })
}
