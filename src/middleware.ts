import { NextRequest, NextResponse } from 'next/server'
import { SHIPPED_LOCALES } from '@/lib/constants'

// Matches the three public page types that have .md markdown twins.
// Tested against the PATH AFTER stripping any locale prefix.
const MD_PAGE = /^\/(product|category|policy)\/([^./]+)$/

// Matches a leading /{locale} segment where locale ∈ SHIPPED_LOCALES (en|fr|ur).
const LOCALE_RE = new RegExp('^/(' + SHIPPED_LOCALES.join('|') + ')(?=/|$)')

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl

  // ── 1. Detect locale prefix ─────────────────────────────────────────────────
  const localeMatch = LOCALE_RE.exec(pathname)
  const locale = localeMatch ? (localeMatch[1] as (typeof SHIPPED_LOCALES)[number]) : null
  const strippedPath = locale ? pathname.replace(LOCALE_RE, '') || '/' : pathname

  // ── 2. Markdown content negotiation (tested against stripped path) ──────────
  const isMdPage = MD_PAGE.test(strippedPath)
  const wantsMarkdown = req.headers.get('accept')?.includes('text/markdown') ?? false

  if (isMdPage && wantsMarkdown) {
    // Rewrite to the .md twin. Inject x-locale if a prefix was present.
    // new URL(req.url) preserves the query string (e.g. ?q=) across the rewrite.
    const target = new URL(req.url)
    target.pathname = `${strippedPath}.md`
    const reqHeaders = new Headers(req.headers)
    if (locale) reqHeaders.set('x-locale', locale)
    const res = NextResponse.rewrite(target, { request: { headers: reqHeaders } })
    if (locale)
      res.cookies.set('NEXT_LOCALE', locale, { path: '/', sameSite: 'lax', maxAge: 31536000 })
    return res
  }

  if (isMdPage && !wantsMarkdown) {
    // HTML request for a content page: add Link alternate header and rewrite if locale-prefixed.
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin

    if (locale) {
      // Locale-prefixed path: rewrite to strip the prefix, inject header, set cookie.
      const target = new URL(req.url)
      target.pathname = strippedPath
      const reqHeaders = new Headers(req.headers)
      reqHeaders.set('x-locale', locale)
      const res = NextResponse.rewrite(target, { request: { headers: reqHeaders } })
      res.headers.set('Link', `<${base}${strippedPath}.md>; rel="alternate"; type="text/markdown"`)
      res.cookies.set('NEXT_LOCALE', locale, { path: '/', sameSite: 'lax', maxAge: 31536000 })
      return res
    }

    // No locale prefix — just add the Link header.
    const res = NextResponse.next()
    res.headers.set('Link', `<${base}${strippedPath}.md>; rel="alternate"; type="text/markdown"`)
    return res
  }

  // ── 3. Non-content pages with a locale prefix — rewrite to strip the prefix ─
  if (locale) {
    const target = new URL(req.url)
    target.pathname = strippedPath
    const reqHeaders = new Headers(req.headers)
    reqHeaders.set('x-locale', locale)
    const res = NextResponse.rewrite(target, { request: { headers: reqHeaders } })
    res.cookies.set('NEXT_LOCALE', locale, { path: '/', sameSite: 'lax', maxAge: 31536000 })
    return res
  }

  // ── 4. No locale prefix, non-content path — pass through unchanged ──────────
  return NextResponse.next()
}

// Broad matcher: runs on all store pages but skips internals and static assets.
// The .md twin routes are internal rewrites, not public URLs, so they never hit
// this matcher (they resolve after the rewrite, inside Next's router).
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|cdn|favicon.ico|.*\\..*).*)'],
}
