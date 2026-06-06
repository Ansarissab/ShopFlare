// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ApiError,
  WORKER_URL,
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  apiPatch,
  apiUpload,
  prefetch,
  drainOfflineQueue,
  apiPostQueued,
} from '@/lib/api'

// Build a Response-like fetch result.
function jsonResponse(body: unknown, status = 200) {
  const text = body === undefined ? '' : JSON.stringify(body)
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(text),
  } as unknown as Response
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn(() => Promise.resolve(jsonResponse({ ok: true })))
  vi.stubGlobal('fetch', fetchMock)
  // default: online
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true })
})

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('ApiError', () => {
  it('carries status, message, body, and name', () => {
    const e = new ApiError(404, 'not found', { error: 'nope' })
    expect(e).toBeInstanceOf(Error)
    expect(e.status).toBe(404)
    expect(e.message).toBe('not found')
    expect(e.body).toEqual({ error: 'nope' })
    expect(e.name).toBe('ApiError')
  })
})

describe('WORKER_URL', () => {
  it('is a string (env-derived, may be empty in test)', () => {
    expect(typeof WORKER_URL).toBe('string')
  })
})

describe('apiGet', () => {
  it('fetches the path and parses JSON', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ hello: 'world' }))
    const out = await apiGet<{ hello: string }>('/api/products')
    expect(out).toEqual({ hello: 'world' })
    expect(fetchMock).toHaveBeenCalledWith(`${WORKER_URL}/api/products`, expect.objectContaining({}))
  })

  it('returns undefined on an empty body (e.g. 204)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(undefined, 204))
    const out = await apiGet('/api/empty')
    expect(out).toBeUndefined()
  })

  it('forwards custom headers + abort signal', async () => {
    const ctrl = new AbortController()
    await apiGet('/api/x', { headers: { 'X-Foo': 'bar' }, signal: ctrl.signal })
    const init = fetchMock.mock.calls[0][1]
    expect(init.headers).toMatchObject({ 'X-Foo': 'bar' })
    expect(init.signal).toBe(ctrl.signal)
  })

  it('sends credentials:include for admin paths', async () => {
    await apiGet('/api/admin/orders')
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include')
  })

  it('omits credentials for public paths', async () => {
    await apiGet('/api/products')
    expect(fetchMock.mock.calls[0][1].credentials).toBeUndefined()
  })
})

describe('error handling in request()', () => {
  it('throws ApiError using parsed.error', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 400))
    await expect(apiGet('/api/x')).rejects.toMatchObject({ status: 400, message: 'boom' })
  })

  it('falls back to parsed.message when no error key', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ message: 'msg here' }, 422))
    await expect(apiGet('/api/x')).rejects.toMatchObject({ status: 422, message: 'msg here' })
  })

  it('falls back to HTTP <status> when body is non-JSON', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false, status: 500, text: () => Promise.resolve('not json'),
    } as unknown as Response)
    await expect(apiGet('/api/x')).rejects.toMatchObject({ status: 500, message: 'HTTP 500' })
  })

  it('falls back to HTTP <status> when body is empty', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false, status: 503, text: () => Promise.resolve(''),
    } as unknown as Response)
    await expect(apiGet('/api/x')).rejects.toMatchObject({ status: 503, message: 'HTTP 503' })
  })
})

describe('apiPost / apiPut / apiPatch', () => {
  it('POST serializes body and sets JSON content-type', async () => {
    await apiPost('/api/x', { a: 1 })
    const init = fetchMock.mock.calls[0][1]
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ a: 1 }))
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' })
  })

  it('POST with undefined body sends no body and no JSON header', async () => {
    await apiPost('/api/x')
    const init = fetchMock.mock.calls[0][1]
    expect(init.body).toBeUndefined()
    expect(init.headers['Content-Type']).toBeUndefined()
  })

  it('PUT serializes body', async () => {
    await apiPut('/api/x', { b: 2 })
    expect(fetchMock.mock.calls[0][1].method).toBe('PUT')
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ b: 2 }))
  })

  it('PUT with undefined body', async () => {
    await apiPut('/api/x')
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined()
  })

  it('PATCH serializes body', async () => {
    await apiPatch('/api/x', { c: 3 })
    expect(fetchMock.mock.calls[0][1].method).toBe('PATCH')
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ c: 3 }))
  })

  it('PATCH with undefined body', async () => {
    await apiPatch('/api/x')
    expect(fetchMock.mock.calls[0][1].body).toBeUndefined()
  })
})

describe('apiDelete', () => {
  it('uses DELETE method', async () => {
    await apiDelete('/api/x')
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE')
  })
})

describe('apiUpload', () => {
  it('passes FormData straight through (no JSON content-type)', async () => {
    const form = new FormData()
    form.append('file', new Blob(['x']), 'f.png')
    await apiUpload('/api/upload', form)
    const init = fetchMock.mock.calls[0][1]
    expect(init.method).toBe('POST')
    expect(init.body).toBe(form)
    expect(init.headers['Content-Type']).toBeUndefined()
  })
})

describe('prefetch', () => {
  it('fires a force-cache GET and dedups in-flight paths', async () => {
    let resolveFetch: (v: Response) => void = () => {}
    fetchMock.mockImplementation(() => new Promise<Response>(r => { resolveFetch = r }))

    prefetch('/api/p1')
    prefetch('/api/p1') // duplicate while in flight — should be ignored
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(WORKER_URL + '/api/p1', { method: 'GET', cache: 'force-cache' })

    resolveFetch(jsonResponse({}))
    // allow .finally() to run and clear the set
    await Promise.resolve()
    await Promise.resolve()

    prefetch('/api/p1') // now allowed again
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('swallows fetch rejection', async () => {
    fetchMock.mockRejectedValueOnce(new Error('net'))
    expect(() => prefetch('/api/p2')).not.toThrow()
    await Promise.resolve()
  })
})

// ── Offline queue (IDB) ──────────────────────────────────────────────────────
// Minimal fake IndexedDB so we can exercise enqueue + drain without a real DB.
type FakeEntry = { id: string; url: string; body: string; headers?: Record<string, string> }

function makeFakeIDB(initial: FakeEntry[] = []) {
  const store = new Map<string, FakeEntry>(initial.map(e => [e.id, e]))
  const fakeDB = {
    transaction() {
      const tx: Record<string, unknown> = {}
      const objectStore = {
        add(entry: FakeEntry) { store.set(entry.id, entry); queueMicrotask(() => (tx.oncomplete as () => void)?.()); return {} },
        getAll() {
          const req: Record<string, unknown> = {}
          queueMicrotask(() => { (req.onsuccess as () => void)?.() ; })
          Object.defineProperty(req, 'result', { get: () => [...store.values()] })
          return req
        },
        delete(id: string) {
          const req: Record<string, unknown> = {}
          store.delete(id)
          queueMicrotask(() => (req.onsuccess as () => void)?.())
          return req
        },
      }
      tx.objectStore = () => objectStore
      return tx
    },
  }
  return { fakeDB, store }
}

function stubIndexedDB(fakeDB: unknown) {
  vi.stubGlobal('indexedDB', {
    open() {
      const req: Record<string, unknown> = { result: fakeDB }
      queueMicrotask(() => (req.onsuccess as () => void)?.())
      return req
    },
  })
}

describe('drainOfflineQueue', () => {
  it('replays queued items and deletes the ones that succeed', async () => {
    const { fakeDB, store } = makeFakeIDB([
      { id: '1', url: WORKER_URL + '/api/orders', body: '{"x":1}', headers: { 'X-T': 't' } },
    ])
    stubIndexedDB(fakeDB)
    fetchMock.mockResolvedValue(jsonResponse({ ok: true }))

    await drainOfflineQueue()

    expect(fetchMock).toHaveBeenCalledWith(
      WORKER_URL + '/api/orders',
      expect.objectContaining({ method: 'POST', body: '{"x":1}' }),
    )
    expect(store.size).toBe(0)
  })

  it('leaves an item in the queue when replay fails (network error)', async () => {
    const { fakeDB, store } = makeFakeIDB([
      { id: '2', url: WORKER_URL + '/api/orders', body: '{}' },
    ])
    stubIndexedDB(fakeDB)
    fetchMock.mockRejectedValue(new TypeError('offline'))

    await drainOfflineQueue()
    expect(store.size).toBe(1)
  })

  it('leaves item when server responds non-ok', async () => {
    const { fakeDB, store } = makeFakeIDB([
      { id: '3', url: WORKER_URL + '/api/orders', body: '{}' },
    ])
    stubIndexedDB(fakeDB)
    fetchMock.mockResolvedValue(jsonResponse({ error: 'x' }, 500))

    await drainOfflineQueue()
    expect(store.size).toBe(1)
  })

  it('ignores IDB open errors', async () => {
    vi.stubGlobal('indexedDB', {
      open() {
        const req: Record<string, unknown> = { error: new Error('idb down') }
        queueMicrotask(() => (req.onerror as () => void)?.())
        return req
      },
    })
    await expect(drainOfflineQueue()).resolves.toBeUndefined()
  })
})

describe('apiPostQueued', () => {
  it('sends immediately when online', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ created: true }))
    const out = await apiPostQueued<{ created: boolean }>('/api/orders', { a: 1 })
    expect(out).toEqual({ created: true })
  })

  it('queues and returns null when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true })
    const { fakeDB, store } = makeFakeIDB()
    stubIndexedDB(fakeDB)

    const out = await apiPostQueued('/api/orders', { a: 1 }, { headers: { 'X-T': 't' } })
    expect(out).toBeNull()
    expect(store.size).toBe(1)
  })

  it('queues when fetch throws TypeError and connection dropped mid-flight', async () => {
    // online at call time, but fetch throws a network TypeError and onLine flips false
    const { fakeDB, store } = makeFakeIDB()
    stubIndexedDB(fakeDB)
    fetchMock.mockImplementation(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true })
      return Promise.reject(new TypeError('Failed to fetch'))
    })

    const out = await apiPostQueued('/api/orders', { a: 1 })
    expect(out).toBeNull()
    expect(store.size).toBe(1)
  })

  it('rethrows non-network errors', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'bad' }, 400))
    await expect(apiPostQueued('/api/orders', { a: 1 })).rejects.toBeInstanceOf(ApiError)
  })

  it('rethrows a TypeError when still online (not a dropped connection)', async () => {
    // online stays true → the `err instanceof TypeError && !navigator.onLine`
    // guard is false, so the TypeError must propagate rather than be queued.
    fetchMock.mockRejectedValueOnce(new TypeError('boom while online'))
    await expect(apiPostQueued('/api/orders', { a: 1 })).rejects.toBeInstanceOf(TypeError)
  })
})

describe('enqueueOfflineRequest via apiPostQueued — Background Sync registration', () => {
  it('registers the offline-post-queue sync tag when SyncManager is supported', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true })
    const { fakeDB, store } = makeFakeIDB()
    stubIndexedDB(fakeDB)

    const syncRegister = vi.fn(() => Promise.resolve())
    const reg = { sync: { register: syncRegister } }
    Object.defineProperty(navigator, 'serviceWorker', {
      value: { ready: Promise.resolve(reg) },
      configurable: true,
      writable: true,
    })
    vi.stubGlobal('SyncManager', function SyncManager() {})

    const out = await apiPostQueued('/api/orders', { a: 1 })
    expect(out).toBeNull()
    expect(store.size).toBe(1)
    // let the tx.oncomplete microtask + serviceWorker.ready promise settle
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    expect(syncRegister).toHaveBeenCalledWith('offline-post-queue')
  })
})

describe('drainOfflineQueue — getAll error path', () => {
  it('ignores a getAll() read error', async () => {
    const fakeDB = {
      transaction() {
        const objectStore = {
          getAll() {
            const req: Record<string, unknown> = { error: new Error('read failed') }
            queueMicrotask(() => (req.onerror as () => void)?.())
            return req
          },
        }
        return { objectStore: () => objectStore }
      },
    }
    stubIndexedDB(fakeDB)
    await expect(drainOfflineQueue()).resolves.toBeUndefined()
  })
})
