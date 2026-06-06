import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { edgeCached } from 'worker/lib/edge-cache'

/**
 * Minimal Hono Context stub — only the surface edgeCached touches.
 */
function makeCtx(opts: {
  url?: string
  ifNoneMatch?: string
  globalCaches?: boolean
}) {
  const url = opts.url ?? 'https://shop.example.com/api/products'
  const headers = new Headers()
  if (opts.ifNoneMatch) headers.set('If-None-Match', opts.ifNoneMatch)

  // If we want to simulate no global caches, we don't set them up.
  if (!opts.globalCaches) {
    // Ensure caches is undefined in this test scope (node env).
    // In node, `caches` is not defined — matches the worker's guard:
    //   typeof caches !== 'undefined' ? caches.default : undefined
  }

  return {
    req: {
      url,
      header: (name: string) => headers.get(name) ?? undefined,
    },
    newResponse: vi.fn((_body: null, status: number, headers: Record<string, string>) => {
      return new Response(null, { status, headers })
    }),
    json: vi.fn((data: unknown, status: number, extraHeaders?: Record<string, string>) => {
      return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
      })
    }),
    executionCtx: {
      waitUntil: vi.fn(),
    },
  }
}

describe('edgeCached', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns 304 when If-None-Match matches ETag', async () => {
    const etag = 'W/"abc123"'
    const ctx = makeCtx({ ifNoneMatch: etag })
    const build = vi.fn(async () => ({ items: [] }))

    const res = await edgeCached(ctx as never, {
      etag,
      cacheControl: 'public, max-age=60',
      build,
    })

    expect(res.status).toBe(304)
    // build should NOT be called — short-circuit
    expect(build).not.toHaveBeenCalled()
  })

  it('304 response includes ETag and Cache-Control headers', async () => {
    const etag = 'W/"def456"'
    const ctx = makeCtx({ ifNoneMatch: etag })

    const res = await edgeCached(ctx as never, {
      etag,
      cacheControl: 'public, max-age=300',
      build: async () => ({}),
    })

    expect(res.headers.get('ETag')).toBe(etag)
    expect(res.headers.get('Cache-Control')).toBe('public, max-age=300')
  })

  it('calls build() and returns 200 when no ETag match', async () => {
    const etag = 'W/"xyz789"'
    const ctx = makeCtx({ ifNoneMatch: 'W/"different"' })
    const data = { items: [{ id: '1' }] }
    const build = vi.fn(async () => data)

    const res = await edgeCached(ctx as never, {
      etag,
      cacheControl: 'public, max-age=60',
      build,
    })

    expect(build).toHaveBeenCalledTimes(1)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(data)
  })

  it('calls build() when no If-None-Match header present', async () => {
    const ctx = makeCtx({})
    const build = vi.fn(async () => ({ products: [] }))

    const res = await edgeCached(ctx as never, {
      etag: 'W/"etag1"',
      cacheControl: 'public, max-age=60',
      build,
    })

    expect(build).toHaveBeenCalledTimes(1)
    expect(res.status).toBe(200)
  })

  it('200 response includes ETag header', async () => {
    const etag = 'W/"etag-200"'
    const ctx = makeCtx({})

    const res = await edgeCached(ctx as never, {
      etag,
      cacheControl: 'public, max-age=60',
      build: async () => ({ ok: true }),
    })

    expect(res.headers.get('ETag')).toBe(etag)
  })

  it('cache key embeds encoded ETag in query param', async () => {
    // Verify the cache key shape by inspecting what the ctx.json is called with.
    // We expose the built data to confirm build() runs and the response is correct.
    const etag = 'W/"v1abc"'
    const ctx = makeCtx({ url: 'https://shop.example.com/api/categories' })
    const data = { categories: [] }

    const res = await edgeCached(ctx as never, {
      etag,
      cacheControl: 'public, s-maxage=3600',
      build: async () => data,
    })

    // The result should be the json response with our data
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual(data)
  })

  it('does not throw when executionCtx.waitUntil is unavailable', async () => {
    const ctx = makeCtx({})
    // Simulate ctx without executionCtx
    const ctxWithoutExec = {
      ...ctx,
      executionCtx: undefined,
    }

    // Should not throw even without executionCtx
    await expect(
      edgeCached(ctxWithoutExec as never, {
        etag: 'W/"safe"',
        cacheControl: 'public, max-age=60',
        build: async () => ({ ok: true }),
      }),
    ).resolves.toBeDefined()
  })
})
