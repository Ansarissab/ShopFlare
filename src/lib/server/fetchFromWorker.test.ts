import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

// Mock the CF context so we can exercise the service-binding fast-path (env.API).
// Default: throw — mimics `next dev` / unit env with no Cloudflare request context,
// so apiBinding() returns undefined and every existing test keeps using global fetch.
const getCloudflareContextMock = vi.fn<() => unknown>(() => {
  throw new Error('no cloudflare context')
})
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: () => getCloudflareContextMock(),
}))

import { fetchFromWorker, r2Url } from './fetchFromWorker'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

beforeEach(() => {
  // Reset to the no-context default before each test; binding tests opt in explicitly.
  getCloudflareContextMock.mockReset()
  getCloudflareContextMock.mockImplementation(() => {
    throw new Error('no cloudflare context')
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.clearAllMocks()
})

describe('fetchFromWorker', () => {
  it('returns parsed JSON on success', async () => {
    vi.stubEnv('NEXT_PUBLIC_WORKER_URL', 'https://worker.test')
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ storeName: 'Acme' }),
    })
    const result = await fetchFromWorker('/api/config/store')
    expect(result).toEqual({ storeName: 'Acme' })
    expect(fetchMock).toHaveBeenCalledWith('https://worker.test/api/config/store', {
      cache: 'no-store',
    })
  })

  it('returns null on 404', async () => {
    vi.stubEnv('NEXT_PUBLIC_WORKER_URL', 'https://worker.test')
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' })
    expect(await fetchFromWorker('/api/missing')).toBeNull()
  })

  it('returns null on non-ok (non-404) response', async () => {
    vi.stubEnv('NEXT_PUBLIC_WORKER_URL', 'https://worker.test')
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Error' })
    expect(await fetchFromWorker('/api/broken')).toBeNull()
  })

  it('returns null when WORKER_URL is empty', async () => {
    vi.stubEnv('NEXT_PUBLIC_WORKER_URL', '')
    expect(await fetchFromWorker('/api/config/store')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null and logs on fetch throw', async () => {
    vi.stubEnv('NEXT_PUBLIC_WORKER_URL', 'https://worker.test')
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    expect(await fetchFromWorker('/api/config/store')).toBeNull()
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[fetchFromWorker]'),
      'network down',
    )
  })

  it('re-throws Next DYNAMIC_SERVER_USAGE control-flow signals (never swallows them)', async () => {
    vi.stubEnv('NEXT_PUBLIC_WORKER_URL', 'https://worker.test')
    const signal = Object.assign(new Error('dynamic'), { digest: 'DYNAMIC_SERVER_USAGE' })
    fetchMock.mockRejectedValueOnce(signal)
    await expect(fetchFromWorker('/api/config/store')).rejects.toBe(signal)
  })

  it('re-throws Next NEXT_* control-flow signals (e.g. NEXT_REDIRECT)', async () => {
    vi.stubEnv('NEXT_PUBLIC_WORKER_URL', 'https://worker.test')
    const signal = Object.assign(new Error('redirect'), {
      digest: 'NEXT_REDIRECT;replace;/login;307',
    })
    fetchMock.mockRejectedValueOnce(signal)
    await expect(fetchFromWorker('/api/config/store')).rejects.toBe(signal)
  })

  it('revalidate option is accepted but fetch always uses cache: no-store', async () => {
    vi.stubEnv('NEXT_PUBLIC_WORKER_URL', 'https://worker.test')
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

    await fetchFromWorker('/api/config/store', { revalidate: false })
    expect(fetchMock).toHaveBeenLastCalledWith(expect.any(String), { cache: 'no-store' })

    await fetchFromWorker('/api/config/store', { revalidate: 300 })
    expect(fetchMock).toHaveBeenLastCalledWith(expect.any(String), { cache: 'no-store' })
  })
})

describe('fetchFromWorker — service binding (env.API) fast-path', () => {
  const bindingFetch = vi.fn()

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_WORKER_URL', 'https://worker.test')
    bindingFetch.mockReset()
    // CF context present with the API service binding wired.
    getCloudflareContextMock.mockImplementation(() => ({ env: { API: { fetch: bindingFetch } } }))
  })

  it('uses the binding (no public round-trip) and returns its JSON on 200', async () => {
    bindingFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ via: 'binding' }),
    })
    const result = await fetchFromWorker('/api/config/store')
    expect(result).toEqual({ via: 'binding' })
    expect(bindingFetch).toHaveBeenCalledWith('https://worker.test/api/config/store')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back to the public fetch when the binding returns 5xx', async () => {
    bindingFetch.mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Unavailable' })
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ via: 'public' }),
    })
    const result = await fetchFromWorker('/api/config/store')
    expect(result).toEqual({ via: 'public' })
    expect(fetchMock).toHaveBeenCalledWith('https://worker.test/api/config/store', {
      cache: 'no-store',
    })
  })

  it('does NOT fall back on a 5xx when allowNonOk (the 5xx body is valid data)', async () => {
    bindingFetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({ degraded: true }),
    })
    const result = await fetchFromWorker('/api/healthz', { allowNonOk: true })
    expect(result).toEqual({ degraded: true })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back to the public fetch when the binding throws', async () => {
    bindingFetch.mockRejectedValueOnce(new Error('binding unavailable'))
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ via: 'public' }),
    })
    const result = await fetchFromWorker('/api/config/store')
    expect(result).toEqual({ via: 'public' })
    expect(fetchMock).toHaveBeenCalledWith('https://worker.test/api/config/store', {
      cache: 'no-store',
    })
  })
})

describe('r2Url', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('returns null for null key', () => {
    expect(r2Url(null)).toBeNull()
  })

  it('returns null for undefined key', () => {
    expect(r2Url(undefined)).toBeNull()
  })

  it('returns null for empty string key', () => {
    expect(r2Url('')).toBeNull()
  })

  it('builds CDN URL from NEXT_PUBLIC_WORKER_URL + key', () => {
    vi.stubEnv('NEXT_PUBLIC_WORKER_URL', 'https://worker.test')
    expect(r2Url('images/hero.avif')).toBe('https://worker.test/cdn/images/hero.avif')
  })

  it('uses empty base when env is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_WORKER_URL', '')
    expect(r2Url('img/logo.png')).toBe('/cdn/img/logo.png')
  })
})
