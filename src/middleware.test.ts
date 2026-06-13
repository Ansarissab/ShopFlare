// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Mock next/server ────────────────────────────────────────────────────────
// Track response cookies and headers independently per call.
type MockResponse = {
  rewriteUrl?: string
  type: 'next' | 'rewrite'
  headers: Record<string, string>
  cookies: Record<string, { value: string; opts: Record<string, unknown> }>
}

let lastRes: MockResponse

const makeResObj = (type: 'next' | 'rewrite', rewriteUrl?: string): MockResponse => {
  const obj: MockResponse = { type, rewriteUrl, headers: {}, cookies: {} }
  ;(obj as unknown as Record<string, unknown>).headers = {
    _store: {} as Record<string, string>,
    set: (k: string, v: string) => {
      ;(obj.headers as unknown as Record<string, Record<string, string>>)['_store'] ??= {}
      ;(obj.headers as unknown as { _store: Record<string, string> })._store[k] = v
    },
    get: (k: string) =>
      (obj.headers as unknown as { _store: Record<string, string> })._store?.[k] ?? null,
  }
  ;(obj as unknown as Record<string, unknown>).cookies = {
    set: (k: string, v: string, opts: Record<string, unknown>) => {
      obj.cookies[k] = { value: v, opts }
    },
  }
  lastRes = obj
  return obj
}

const mockNextFn = vi.fn(() => makeResObj('next'))
const mockRewriteFn = vi.fn((url: URL, _opts?: unknown) => makeResObj('rewrite', url.toString()))

vi.mock('next/server', () => ({
  NextResponse: {
    next: mockNextFn,
    rewrite: mockRewriteFn,
  },
}))

const { middleware } = await import('./middleware')

// ─── Helpers ─────────────────────────────────────────────────────────────────

type FakeReq = Parameters<typeof middleware>[0]

function makeReq(pathname: string, accept?: string): FakeReq {
  const headers: Record<string, string> = {}
  if (accept) headers['accept'] = accept

  return {
    nextUrl: { pathname, origin: 'https://store.example.com' },
    url: `https://store.example.com${pathname}`,
    headers: {
      get: (k: string) => headers[k.toLowerCase()] ?? null,
      // Headers constructor mirror for spread
      forEach: (cb: (v: string, k: string) => void) =>
        Object.entries(headers).forEach(([k, v]) => cb(v, k)),
      entries: () => Object.entries(headers)[Symbol.iterator](),
    },
  } as unknown as FakeReq
}

/** Read the 'Link' header from the last response. */
function getLinkHeader(): string | null {
  return (
    (lastRes?.headers as unknown as { get: (k: string) => string | null }).get?.('Link') ?? null
  )
}

/** Read a response cookie value. */
function getCookie(name: string): string | null {
  return lastRes?.cookies?.[name]?.value ?? null
}

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    lastRes = undefined as unknown as MockResponse
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL
  })

  // ── Locale prefix routing ────────────────────────────────────────────────────

  describe('locale prefix routing', () => {
    it('/fr/shop rewrites to /shop with x-locale: fr and sets cookie', () => {
      middleware(makeReq('/fr/shop'))
      expect(mockRewriteFn).toHaveBeenCalledOnce()
      const [url, opts] = mockRewriteFn.mock.calls[0] as [URL, { request: { headers: Headers } }]
      expect(url.pathname).toBe('/shop')
      const xLocale = (
        opts.request.headers as unknown as { get: (k: string) => string | null }
      ).get('x-locale')
      expect(xLocale).toBe('fr')
      expect(getCookie('NEXT_LOCALE')).toBe('fr')
    })

    it('/ur/product/x rewrites to /product/x with x-locale: ur', () => {
      middleware(makeReq('/ur/product/x'))
      expect(mockRewriteFn).toHaveBeenCalledOnce()
      const [url, opts] = mockRewriteFn.mock.calls[0] as [URL, { request: { headers: Headers } }]
      expect(url.pathname).toBe('/product/x')
      const xLocale = (
        opts.request.headers as unknown as { get: (k: string) => string | null }
      ).get('x-locale')
      expect(xLocale).toBe('ur')
      expect(getCookie('NEXT_LOCALE')).toBe('ur')
    })

    it('/en/shop rewrites to /shop with x-locale: en', () => {
      middleware(makeReq('/en/shop'))
      expect(mockRewriteFn).toHaveBeenCalledOnce()
      const [url] = mockRewriteFn.mock.calls[0] as [URL]
      expect(url.pathname).toBe('/shop')
      expect(getCookie('NEXT_LOCALE')).toBe('en')
    })

    it('/{locale} root (no trailing path) rewrites to /', () => {
      middleware(makeReq('/fr'))
      expect(mockRewriteFn).toHaveBeenCalledOnce()
      const [url] = mockRewriteFn.mock.calls[0] as [URL]
      expect(url.pathname).toBe('/')
    })

    it('unprefixed /shop passes through with NO x-locale header injection', () => {
      middleware(makeReq('/shop'))
      expect(mockNextFn).toHaveBeenCalledOnce()
      expect(mockRewriteFn).not.toHaveBeenCalled()
      expect(getCookie('NEXT_LOCALE')).toBeNull()
    })
  })

  // ── Markdown + locale composition ─────────────────────────────────────────

  describe('locale-prefixed markdown requests', () => {
    it('/ur/product/x with Accept: text/markdown rewrites to /product/x.md', () => {
      middleware(makeReq('/ur/product/x', 'text/markdown'))
      expect(mockRewriteFn).toHaveBeenCalledOnce()
      const [url, opts] = mockRewriteFn.mock.calls[0] as [URL, { request: { headers: Headers } }]
      expect(url.pathname).toBe('/product/x.md')
      const xLocale = (
        opts.request.headers as unknown as { get: (k: string) => string | null }
      ).get('x-locale')
      expect(xLocale).toBe('ur')
    })

    it('/fr/category/tops with Accept: text/markdown rewrites to /category/tops.md', () => {
      middleware(makeReq('/fr/category/tops', 'text/markdown'))
      expect(mockRewriteFn).toHaveBeenCalledOnce()
      const [url] = mockRewriteFn.mock.calls[0] as [URL]
      expect(url.pathname).toBe('/category/tops.md')
    })
  })

  // ── Non-matching paths ────────────────────────────────────────────────────

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

  // ── HTML requests (no Accept: text/markdown) ──────────────────────────────

  describe('HTML requests (no Accept: text/markdown)', () => {
    it('adds Link header for product page', () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://mystore.com'
      middleware(makeReq('/product/cool-shirt'))
      expect(mockNextFn).toHaveBeenCalledOnce()
      expect(getLinkHeader()).toBe(
        '<https://mystore.com/product/cool-shirt.md>; rel="alternate"; type="text/markdown"',
      )
    })

    it('adds Link header for category page', () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://mystore.com'
      middleware(makeReq('/category/tops'))
      expect(getLinkHeader()).toBe(
        '<https://mystore.com/category/tops.md>; rel="alternate"; type="text/markdown"',
      )
    })

    it('adds Link header for policy page', () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://mystore.com'
      middleware(makeReq('/policy/shipping'))
      expect(getLinkHeader()).toBe(
        '<https://mystore.com/policy/shipping.md>; rel="alternate"; type="text/markdown"',
      )
    })

    it('falls back to request origin when NEXT_PUBLIC_SITE_URL is unset', () => {
      middleware(makeReq('/product/test'))
      expect(getLinkHeader()).toBe(
        '<https://store.example.com/product/test.md>; rel="alternate"; type="text/markdown"',
      )
    })

    it('does NOT rewrite for generic Accept header', () => {
      middleware(makeReq('/product/shirt', 'text/html,application/xhtml+xml'))
      expect(mockRewriteFn).not.toHaveBeenCalled()
      expect(getLinkHeader()).toBeTruthy()
    })

    it('/fr/product/slug (HTML) rewrites to /product/slug and includes Link header', () => {
      process.env.NEXT_PUBLIC_SITE_URL = 'https://mystore.com'
      middleware(makeReq('/fr/product/cool-shirt'))
      expect(mockRewriteFn).toHaveBeenCalledOnce()
      const [url] = mockRewriteFn.mock.calls[0] as [URL]
      expect(url.pathname).toBe('/product/cool-shirt')
      expect(getLinkHeader()).toBe(
        '<https://mystore.com/product/cool-shirt.md>; rel="alternate"; type="text/markdown"',
      )
    })
  })

  // ── Accept: text/markdown content negotiation ─────────────────────────────

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

    it('does NOT call NextResponse.next() for markdown rewrites', () => {
      middleware(makeReq('/product/shirt', 'text/markdown'))
      expect(mockNextFn).not.toHaveBeenCalled()
    })
  })
})
