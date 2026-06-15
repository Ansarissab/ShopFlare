import { describe, it, expect, vi, afterEach } from 'vitest'
import { pingIndexNow } from 'worker/lib/indexnow'
import type { Database } from 'worker/db/index'
import type { Bindings } from 'worker/types'
import { INDEXNOW_ENDPOINT, INDEXNOW_KEY_PATH } from '@/lib/constants'

afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * Builds a minimal mock Database whose select chain resolves to `row`.
 * Matches the single-row query pattern used by pingIndexNow:
 *   db.select({ value }).from(storeConfig).where(...).get()
 */
function makeDb(row: { value: string } | undefined) {
  const get = vi.fn().mockResolvedValue(row)
  const where = vi.fn(() => ({ get }))
  const from = vi.fn(() => ({ where }))
  const select = vi.fn(() => ({ from }))
  return { db: { select } as unknown as Database, get }
}

const env = { FRONTEND_URL: 'https://example.com' } as unknown as Bindings

describe('pingIndexNow', () => {
  it('does nothing (fetch not called) when indexNowKey is empty string', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response())
    const { db } = makeDb({ value: '' })

    await pingIndexNow(db, env, ['/product/abc'])

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('does nothing (fetch not called) when no store_config row exists', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response())
    const { db } = makeDb(undefined)

    await pingIndexNow(db, env, ['/product/abc'])

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('POSTs correct payload to INDEXNOW_ENDPOINT when key is set', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response())
    const { db } = makeDb({ value: 'my-secret-key' })

    await pingIndexNow(db, env, ['/product/abc', '/product/xyz'])

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(INDEXNOW_ENDPOINT)
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({ 'content-type': 'application/json; charset=utf-8' })

    const body = JSON.parse(init.body as string) as {
      host: string
      key: string
      keyLocation: string
      urlList: string[]
    }
    expect(body.host).toBe('example.com')
    expect(body.key).toBe('my-secret-key')
    expect(body.keyLocation).toBe(`https://example.com${INDEXNOW_KEY_PATH}`)
    expect(body.urlList).toEqual([
      'https://example.com/product/abc',
      'https://example.com/product/xyz',
    ])
  })

  it('swallows fetch rejection — does not throw', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'))
    // Expected: pingIndexNow logs the failure via console.error — silence it so
    // the deliberate error doesn't pollute the test output / mask real errors.
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { db } = makeDb({ value: 'my-secret-key' })

    // Must not throw
    await expect(pingIndexNow(db, env, ['/product/abc'])).resolves.toBeUndefined()
    expect(errSpy).toHaveBeenCalled()
  })
})
