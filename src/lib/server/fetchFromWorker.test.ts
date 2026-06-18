import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchFromWorker, r2Url } from './fetchFromWorker'

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

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

  it('revalidate option is accepted but fetch always uses cache: no-store', async () => {
    vi.stubEnv('NEXT_PUBLIC_WORKER_URL', 'https://worker.test')
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

    await fetchFromWorker('/api/config/store', { revalidate: false })
    expect(fetchMock).toHaveBeenLastCalledWith(expect.any(String), { cache: 'no-store' })

    await fetchFromWorker('/api/config/store', { revalidate: 300 })
    expect(fetchMock).toHaveBeenLastCalledWith(expect.any(String), { cache: 'no-store' })
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
