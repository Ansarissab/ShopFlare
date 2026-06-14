// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Mock next/server ────────────────────────────────────────────────────────
// Track response cookies and headers independently per call.
type MockResponse = {
  rewriteUrl?: string
  type: 'next' | 'rewrite'
  headers: Record<string, string>
  cookies: Record<string, { value: string; opts: Record<string, unknown> }>
  // The headers passed to request: { headers } option, captured for assertions
  reqHeaders?: Headers
}

let lastRes: MockResponse

const makeResObj = (
  type: 'next' | 'rewrite',
  rewriteUrl?: string,
  reqHeaders?: Headers,
): MockResponse => {
  const obj: MockResponse = { type, rewriteUrl, headers: {}, cookies: {}, reqHeaders }
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

const mockNextFn = vi.fn((opts?: { request?: { headers?: Headers } }) =>
  makeResObj('next', undefined, opts?.request?.headers),
)
const mockRewriteFn = vi.fn((url: URL, opts?: { request?: { headers?: Headers } }) =>
  makeResObj('rewrite', url.toString(), opts?.request?.headers),
)

vi.mock('next/server', () => ({
  NextResponse: {
    next: mockNextFn,
    rewrite: mockRewriteFn,
  },
}))

const { middleware, resolveLocale } = await import('./middleware')

// ─── Helpers ─────────────────────────────────────────────────────────────────

type FakeReq = Parameters<typeof middleware>[0]

/**
 * Build a fake NextRequest.
 * @param pathname - URL path
 * @param accept   - value for the Accept header (optional)
 * @param cookieHeader - raw Cookie header string e.g. 'NEXT_LOCALE=fr' (optional)
 * @param spoofedXLocale - value for an incoming x-locale header (spoofing test)
 */
function makeReq(
  pathname: string,
  accept?: string,
  cookieHeader?: string,
  spoofedXLocale?: string,
): FakeReq {
  const rawHeaders: Record<string, string> = {}
  if (accept) rawHeaders['accept'] = accept
  if (cookieHeader) rawHeaders['cookie'] = cookieHeader
  if (spoofedXLocale) rawHeaders['x-locale'] = spoofedXLocale

  // Parse cookie header into a map for req.cookies.get()
  const cookieMap: Record<string, string> = {}
  if (cookieHeader) {
    for (const part of cookieHeader.split(';')) {
      const [k, v] = part.trim().split('=')
      if (k && v !== undefined) cookieMap[k.trim()] = v.trim()
    }
  }

  return {
    nextUrl: { pathname, origin: 'https://store.example.com' },
    url: `https://store.example.com${pathname}`,
    headers: {
      get: (k: string) => rawHeaders[k.toLowerCase()] ?? null,
      forEach: (cb: (v: string, k: string) => void) =>
        Object.entries(rawHeaders).forEach(([k, v]) => cb(v, k)),
      entries: () => Object.entries(rawHeaders)[Symbol.iterator](),
    },
    cookies: {
      get: (name: string) =>
        cookieMap[name] !== undefined ? { value: cookieMap[name] } : undefined,
    },
  } as unknown as FakeReq
}

/** Read the 'Link' header from the last response. */
function getLinkHeader(): string | null {
  if (!lastRes) return null
  return (lastRes.headers as unknown as { get: (k: string) => string | null }).get('Link')
}

/** Read a response cookie value. */
function getCookie(name: string): string | null {
  return lastRes?.cookies?.[name]?.value ?? null
}

/** Read x-locale from the forwarded request headers captured in lastRes. */
function getForwardedXLocale(): string | null {
  const h = lastRes?.reqHeaders
  if (!h) return null
  return (h as unknown as { get: (k: string) => string | null }).get('x-locale')
}

describe('middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    lastRes = undefined as unknown as MockResponse
  })

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL
  })

  // ── resolveLocale pure helper ─────────────────────────────────────────────

  describe('resolveLocale', () => {
    it('URL prefix present → returns locale + strippedPath + fromPrefix=true', () => {
      const result = resolveLocale({
        nextUrl: { pathname: '/fr/shop' },
        cookies: { get: () => undefined },
      })
      expect(result).toEqual({ locale: 'fr', strippedPath: '/shop', fromPrefix: true })
    })

    it('/{locale} root only → strippedPath is /', () => {
      const result = resolveLocale({
        nextUrl: { pathname: '/ur' },
        cookies: { get: () => undefined },
      })
      expect(result).toEqual({ locale: 'ur', strippedPath: '/', fromPrefix: true })
    })

    it('no prefix + valid cookie → locale from cookie, fromPrefix=false', () => {
      const result = resolveLocale({
        nextUrl: { pathname: '/shop' },
        cookies: { get: (n) => (n === 'NEXT_LOCALE' ? { value: 'fr' } : undefined) },
      })
      expect(result).toEqual({ locale: 'fr', strippedPath: '/shop', fromPrefix: false })
    })

    it('no prefix + invalid cookie → locale=null', () => {
      const result = resolveLocale({
        nextUrl: { pathname: '/shop' },
        cookies: { get: (n) => (n === 'NEXT_LOCALE' ? { value: 'xx' } : undefined) },
      })
      expect(result).toEqual({ locale: null, strippedPath: '/shop', fromPrefix: false })
    })

    it('no prefix + no cookie → locale=null', () => {
      const result = resolveLocale({
        nextUrl: { pathname: '/shop' },
        cookies: { get: () => undefined },
      })
      expect(result).toEqual({ locale: null, strippedPath: '/shop', fromPrefix: false })
    })
  })

  // ── Locale prefix routing ────────────────────────────────────────────────────

  describe('locale prefix routing', () => {
    it('/fr/shop rewrites to /shop with x-locale: fr and sets cookie', () => {
      middleware(makeReq('/fr/shop'))
      expect(mockRewriteFn).toHaveBeenCalledOnce()
      const [url] = mockRewriteFn.mock.calls[0] as [URL, unknown]
      expect(url.pathname).toBe('/shop')
      expect(getForwardedXLocale()).toBe('fr')
      expect(getCookie('NEXT_LOCALE')).toBe('fr')
    })

    it('/ur/product/x rewrites to /product/x with x-locale: ur', () => {
      middleware(makeReq('/ur/product/x'))
      expect(mockRewriteFn).toHaveBeenCalledOnce()
      const [url] = mockRewriteFn.mock.calls[0] as [URL, unknown]
      expect(url.pathname).toBe('/product/x')
      expect(getForwardedXLocale()).toBe('ur')
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

    it('unprefixed /shop with no cookie passes through, no x-locale injected', () => {
      middleware(makeReq('/shop'))
      expect(mockNextFn).toHaveBeenCalledOnce()
      expect(mockRewriteFn).not.toHaveBeenCalled()
      expect(getCookie('NEXT_LOCALE')).toBeNull()
      expect(getForwardedXLocale()).toBeNull()
    })
  })

  // ── Cookie-based locale (no URL prefix) ───────────────────────────────────

  describe('cookie-based locale (no URL prefix)', () => {
    it('unprefixed /shop WITH Cookie: NEXT_LOCALE=fr → NO rewrite, x-locale: fr forwarded', () => {
      middleware(makeReq('/shop', undefined, 'NEXT_LOCALE=fr'))
      // Must NOT rewrite (URL stays /shop)
      expect(mockRewriteFn).not.toHaveBeenCalled()
      expect(mockNextFn).toHaveBeenCalledOnce()
      // x-locale must be injected into the forwarded request headers
      expect(getForwardedXLocale()).toBe('fr')
      // No cookie set on the response (cookie already present)
      expect(getCookie('NEXT_LOCALE')).toBeNull()
    })

    it('unprefixed /shop WITH Cookie: NEXT_LOCALE=ur → x-locale: ur forwarded', () => {
      middleware(makeReq('/shop', undefined, 'NEXT_LOCALE=ur'))
      expect(mockRewriteFn).not.toHaveBeenCalled()
      expect(getForwardedXLocale()).toBe('ur')
    })

    it('unprefixed /shop with invalid cookie value → no x-locale injected', () => {
      middleware(makeReq('/shop', undefined, 'NEXT_LOCALE=xx'))
      expect(mockRewriteFn).not.toHaveBeenCalled()
      expect(getForwardedXLocale()).toBeNull()
    })
  })

  // ── Anti-spoofing ─────────────────────────────────────────────────────────

  describe('x-locale anti-spoofing', () => {
    it('incoming x-locale: ur with NO cookie and NO prefix → x-locale deleted from forwarded headers', () => {
      // Spoofer sends x-locale: ur but there is no prefix and no cookie
      middleware(makeReq('/shop', undefined, undefined, 'ur'))
      expect(mockNextFn).toHaveBeenCalledOnce()
      expect(mockRewriteFn).not.toHaveBeenCalled()
      // x-locale must be absent/null in the forwarded headers
      expect(getForwardedXLocale()).toBeNull()
    })

    it('incoming x-locale: fr with Cookie: NEXT_LOCALE=ur → cookie wins, x-locale: ur forwarded', () => {
      // Cookie says ur, spoofer says fr — cookie should win
      middleware(makeReq('/shop', undefined, 'NEXT_LOCALE=ur', 'fr'))
      expect(mockNextFn).toHaveBeenCalledOnce()
      expect(getForwardedXLocale()).toBe('ur')
    })
  })

  // ── Dotted slugs (matcher fix verification) ───────────────────────────────

  describe('dotted slug paths', () => {
    /**
     * NOTE: The matcher config governs whether middleware is INVOKED at all
     * (Next.js evaluates it before calling the function). The handler itself
     * always runs during tests because we call it directly. This test confirms
     * the handler correctly processes /fr/product/my.item — the matcher fix
     * ensures it also gets invoked in production (`.item` is not in the
     * excluded extension list).
     */
    it('/fr/product/my.item → rewrites to /product/my.item (handler processes dotted slugs)', () => {
      middleware(makeReq('/fr/product/my.item'))
      expect(mockRewriteFn).toHaveBeenCalledOnce()
      const [url] = mockRewriteFn.mock.calls[0] as [URL]
      expect(url.pathname).toBe('/product/my.item')
      expect(getForwardedXLocale()).toBe('fr')
      expect(getCookie('NEXT_LOCALE')).toBe('fr')
    })

    it('/product/my.item (no prefix, no cookie) → passes through unchanged', () => {
      middleware(makeReq('/product/my.item'))
      expect(mockNextFn).toHaveBeenCalledOnce()
      expect(mockRewriteFn).not.toHaveBeenCalled()
    })
  })

  // ── Markdown + locale composition ─────────────────────────────────────────

  describe('locale-prefixed markdown requests', () => {
    it('/ur/product/x with Accept: text/markdown rewrites to /product/x.md', () => {
      middleware(makeReq('/ur/product/x', 'text/markdown'))
      expect(mockRewriteFn).toHaveBeenCalledOnce()
      const [url] = mockRewriteFn.mock.calls[0] as [URL, unknown]
      expect(url.pathname).toBe('/product/x.md')
      expect(getForwardedXLocale()).toBe('ur')
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
