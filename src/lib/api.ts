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
    public readonly body?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Per-call options. `headers` merges over the defaults (e.g. an
// `X-Turnstile-Token` on protected POSTs) so callers never reach for raw fetch.
export type ApiOptions = {
  headers?: Record<string, string>
  signal?: AbortSignal
}

async function request<T>(path: string, init?: RequestInit & { signal?: AbortSignal }): Promise<T> {
  const res = await fetch(`${WORKER_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  })

  if (!res.ok) {
    const raw = await res.text()
    let parsed: unknown
    try { parsed = JSON.parse(raw) } catch { parsed = undefined }
    const msg =
      parsed && typeof parsed === 'object' && parsed !== null
        ? ((parsed as Record<string, unknown>).error ?? (parsed as Record<string, unknown>).message ?? `HTTP ${res.status}`)
        : `HTTP ${res.status}`
    throw new ApiError(res.status, String(msg), parsed)
  }

  // Tolerate empty bodies (e.g. 204) without throwing on JSON.parse.
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export function apiGet<T>(path: string, opts?: ApiOptions): Promise<T> {
  return request<T>(path, { headers: opts?.headers, signal: opts?.signal })
}

export function apiPost<T>(path: string, body?: unknown, opts?: ApiOptions): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: opts?.headers,
    signal: opts?.signal,
  })
}
