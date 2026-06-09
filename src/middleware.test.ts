// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock next/server before importing middleware
const mockResHeaders: Record<string, string> = {}
const mockNextFn = vi.fn(() => ({
  headers: {
    set: (k: string, v: string) => { mockResHeaders[k] = v },
    get: (k: string) => mockResHeaders[k] ?? null,
  },
}))
const mockRewriteFn = vi.fn((url: URL) => ({ rewriteUrl: url.toString(), type: 'rewrite' }))

vi.mock('next/server', () => ({
  NextResponse: {
    next: mockNextFn,
    rewrite: mockRewriteFn,
  },
}))

const { middleware } = await import('./middleware')

function makeReq(pathname: string, accept?: string): Parameters<typeof middleware>[0] {
  return {
    nextUrl: { pathname, origin: 'https://store.example.com' },
    url: `https://store.example.com${pathname}`,
    headers: {
      get: (k: string) =>
        k.toLowerCase() === 'accept' && accept ? accept : null,
    },
  } as unknown as Parameters<typeof middleware>[0]
}

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(mockResHeaders).forEach((k) => delete mockResHeaders[k])
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL
  })

  describe('non-matching paths', () => {
    it('passes through home page', () => {
      middleware(makeReq('/'))
      expect(mockNextFn).toHaveBeenCalledOnce()
      expect(mockRewriteFn).not.toHaveBeenCalled()
    })

    it('passes through shop page', () => {
      middleware(makeReq('/shop'))
      expect(mockNextFn).toHaveBeenCalledOnce()
    })

    it('passes through admin paths', () => {
      middleware(makeReq('/admin/settings'))
      expect(mockNextFn).toHaveBeenCalledOnce()
      expect(mockRewriteFn).not.toHaveBeenCalled()
    })

    it('passes through .md suffix requests (already routed correctly)', () => {
      middleware(makeReq('/product/shirt.md'))
      expect(mockNextFn).toHaveBeenCalledOnce()
      expect(mockRewriteFn).not.toHaveBeenCalled()
    })
  })

  describe('HTML requests (no Accept: text/markdown)', () => {
    it('adds Link header for product page', () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://mystore.com'
      middleware(makeReq('/product/cool-shirt'))
      expect(mockNextFn).toHaveBeenCalledOnce()
      expect(mockResHeaders['Link']).toBe(
        '<https://mystore.com/product/cool-shirt.md>; rel="alternate"; type="text/markdown"',
      )
    })

    it('adds Link header for category page', () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://mystore.com'
      middleware(makeReq('/category/tops'))
      expect(mockResHeaders['Link']).toBe(
        '<https://mystore.com/category/tops.md>; rel="alternate"; type="text/markdown"',
      )
    })

    it('adds Link header for policy page', () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://mystore.com'
      middleware(makeReq('/policy/shipping'))
      expect(mockResHeaders['Link']).toBe(
        '<https://mystore.com/policy/shipping.md>; rel="alternate"; type="text/markdown"',
      )
    })

    it('falls back to request origin when NEXT_PUBLIC_SITE_URL is unset', () => {
      middleware(makeReq('/product/test'))
      expect(mockResHeaders['Link']).toBe(
        '<https://store.example.com/product/test.md>; rel="alternate"; type="text/markdown"',
      )
    })

    it('does NOT rewrite for generic Accept header', () => {
      middleware(makeReq('/product/shirt', 'text/html,application/xhtml+xml'))
      expect(mockRewriteFn).not.toHaveBeenCalled()
      expect(mockResHeaders['Link']).toBeTruthy()
    })
  })

  describe('Accept: text/markdown content negotiation', () => {
    it('rewrites product page to .md twin', () => {
      middleware(makeReq('/product/cool-shirt', 'text/markdown'))
      expect(mockRewriteFn).toHaveBeenCalledOnce()
      const url: URL = mockRewriteFn.mock.calls[0][0] as URL
      expect(url.pathname).toBe('/product/cool-shirt.md')
    })

    it('rewrites category page to .md twin', () => {
      middleware(makeReq('/category/tops', 'text/markdown'))
      const url: URL = mockRewriteFn.mock.calls[0][0] as URL
      expect(url.pathname).toBe('/category/tops.md')
    })

    it('rewrites policy page to .md twin', () => {
      middleware(makeReq('/policy/returns', 'text/markdown'))
      const url: URL = mockRewriteFn.mock.calls[0][0] as URL
      expect(url.pathname).toBe('/policy/returns.md')
    })

    it('rewrites when Accept includes text/markdown among others', () => {
      middleware(makeReq('/product/shirt', 'text/html, text/markdown, */*'))
      expect(mockRewriteFn).toHaveBeenCalledOnce()
    })

    it('does NOT add Link header for rewrote requests', () => {
      middleware(makeReq('/product/shirt', 'text/markdown'))
      expect(mockNextFn).not.toHaveBeenCalled()
    })
  })
})
