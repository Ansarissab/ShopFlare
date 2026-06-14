import { NextRequest, NextResponse } from 'next/server'
import { SHIPPED_LOCALES } from '@/lib/constants'

// Matches the three public page types that have .md markdown twins.
// Tested against the PATH AFTER stripping any locale prefix.
const MD_PAGE = /^\/(product|category|policy)\/([^./]+)$/

// Matches a leading /{locale} segment where locale ∈ SHIPPED_LOCALES (en|fr|ur).
const LOCALE_RE = new RegExp('^/(' + SHIPPED_LOCALES.join('|') + ')(?=/|$)')

// Inline membership check — does NOT import from @/lib/i18n (that bundles the
// full dictionaries into edge middleware). Uses SHIPPED_LOCALES from constants only.
const isLoc = (x: string | null | undefined): x is (typeof SHIPPED_LOCALES)[number] =>
  !!x && (SHIPPED_LOCALES as readonly string[]).includes(x)

/**
 * resolveLocale — pure helper exported for unit-test convenience.
 *
 * Returns the locale that should govern this request, plus whether it came
 * from a URL prefix (vs. cookie/nothing).
 *
 * - URL prefix present → use it (and strip prefix from path)
 * - No prefix + valid NEXT_LOCALE cookie → use cookie value
 * - Otherwise → null (no locale signal; app defaults to DEFAULT_LOCALE)
 */
export function resolveLocale(req: {
  nextUrl: { pathname: string }
  cookies: { get: (name: string) => { value: string } | undefined }
}): { locale: string | null; strippedPath: string; fromPrefix: boolean } {
  const { pathname } = req.nextUrl
  const localeMatch = LOCALE_RE.exec(pathname)

  if (localeMatch) {
    const locale = localeMatch[1]
    const strippedPath = pathname.replace(LOCALE_RE, '') || '/'
    return { locale, strippedPath, fromPrefix: true }
  }

  // No prefix — try cookie
  const cookieVal = req.cookies.get('NEXT_LOCALE')?.value
  const locale = isLoc(cookieVal) ? cookieVal : null
  return { locale, strippedPath: pathname, fromPrefix: false }
}

export function middleware(req: NextRequest): NextResponse {
  const { locale, strippedPath, fromPrefix } = resolveLocale(req)

  // Build sanitized request headers for every outgoing path.
  // This deletes any client-supplied x-locale when we have none (anti-spoof)
  // and overwrites it otherwise.
  const reqHeaders = new Headers(req.headers)
  if (locale) {
    reqHeaders.set('x-locale', locale)
  } else {
    reqHeaders.delete('x-locale')
  }

  // ── Markdown content negotiation (tested against stripped path) ──────────────
  const isMdPage = MD_PAGE.test(strippedPath)
  const wantsMarkdown = req.headers.get('accept')?.includes('text/markdown') ?? false
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin

  if (isMdPage && wantsMarkdown) {
    // Rewrite to the .md twin, passing sanitized headers.
    const target = new URL(req.url)
    target.pathname = `${strippedPath}.md`
    const res = NextResponse.rewrite(target, { request: { headers: reqHeaders } })
    if (fromPrefix && locale) {
      res.cookies.set('NEXT_LOCALE', locale, {
        path: '/',
        sameSite: 'lax',
        maxAge: 31536000,
        secure: process.env.NODE_ENV !== 'development',
      })
    }
    return res
  }

  if (isMdPage && !wantsMarkdown) {
    // HTML request for a content page: add Link alternate header.
    const linkHeader = `<${base}${strippedPath}.md>; rel="alternate"; type="text/markdown"`

    if (fromPrefix && locale) {
      // Locale-prefixed path: rewrite to strip the prefix, inject headers, set cookie.
      const target = new URL(req.url)
      target.pathname = strippedPath
      const res = NextResponse.rewrite(target, { request: { headers: reqHeaders } })
      res.headers.set('Link', linkHeader)
      res.cookies.set('NEXT_LOCALE', locale, {
        path: '/',
        sameSite: 'lax',
        maxAge: 31536000,
        secure: process.env.NODE_ENV !== 'development',
      })
      return res
    }

    // No locale prefix — add the Link header and pass sanitized request headers through.
    const res = NextResponse.next({ request: { headers: reqHeaders } })
    res.headers.set('Link', linkHeader)
    return res
  }

  // ── Non-content pages ────────────────────────────────────────────────────────

  if (fromPrefix && locale) {
    // Locale-prefixed path: rewrite to strip the prefix, set cookie.
    const target = new URL(req.url)
    target.pathname = strippedPath
    const res = NextResponse.rewrite(target, { request: { headers: reqHeaders } })
    res.cookies.set('NEXT_LOCALE', locale, {
      path: '/',
      sameSite: 'lax',
      maxAge: 31536000,
      secure: process.env.NODE_ENV !== 'development',
    })
    return res
  }

  // No prefix: pass through with sanitized headers (injects cookie-derived x-locale
  // or deletes a spoofed one — no URL change, no cookie write).
  return NextResponse.next({ request: { headers: reqHeaders } })
}

// Broad matcher: runs on all store pages but skips internals and actual static
// asset extensions. Only real file-extension endings are excluded — paths that
// merely CONTAIN a dot in a slug segment (e.g. /fr/product/my.item) still run.
// Excluded extensions: images, fonts, js/css, data/manifest files.
export const config = {
  matcher: [
    '/((?!api/|_next/|cdn/|favicon\\.ico|.*\\.(?:png|jpe?g|gif|svg|webp|avif|ico|txt|xml|json|webmanifest|js|css|map|woff2?|ttf|otf)$).*)',
  ],
}
