// @vitest-environment node
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

// Regression: products have no slug column — they're identified by id and the
// /api/products response is { products: [{ product: { id } }] }. The sitemap
// previously cast that wrapper object to an array and read `p.slug`, so every
// product was silently dropped from the sitemap. Guard the id-based mapping.

const ORIGIN = 'https://shop.example.com'

/** Build a fetch stub that dispatches by URL pathname. */
function mockFetch(handlers: Record<string, unknown>) {
  return vi.fn(async (url: string) => {
    const path = new URL(url).pathname
    const body = handlers[path]
    if (body === undefined) return { ok: false, json: async () => ({}) } as Response
    return { ok: true, json: async () => body } as unknown as Response
  })
}

describe('sitemap', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_WORKER_URL', 'https://api.example.com')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', ORIGIN)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it('emits /product/{id} entries from the { products: [{ product }] } shape', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch({
        '/api/pages': [],
        '/api/config/store': { enabledLocales: ['en'] },
        '/api/products': {
          products: [
            { product: { id: 'p1', updatedAt: '2026-01-02T00:00:00.000Z' } },
            { product: { id: 'p2' } },
          ],
        },
        '/api/categories': { categories: [] },
        '/api/blog': { posts: [] },
      }),
    )

    const { default: sitemap } = await import('./sitemap')
    const routes = await sitemap()
    const urls = routes.map((r) => r.url)

    expect(urls).toContain(`${ORIGIN}/product/p1`)
    expect(urls).toContain(`${ORIGIN}/product/p2`)

    const p1 = routes.find((r) => r.url === `${ORIGIN}/product/p1`)
    expect(p1?.lastModified).toEqual(new Date('2026-01-02T00:00:00.000Z'))
    // hreflang alternates wired for the product route
    expect(p1?.alternates?.languages?.en).toBe(`${ORIGIN}/product/p1`)
  })

  it('omits product routes gracefully when the worker is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline')
      }),
    )

    const { default: sitemap } = await import('./sitemap')
    const routes = await sitemap()

    expect(routes.some((r) => r.url.includes('/product/'))).toBe(false)
    expect(routes.length).toBeGreaterThan(0) // static root still emitted
  })
})
