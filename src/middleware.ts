import { NextRequest, NextResponse } from 'next/server'

// Matches the three public page types that have .md markdown twins.
const MD_PAGE = /^\/(product|category|policy)\/([^./]+)$/

export function middleware(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl
  if (!MD_PAGE.test(pathname)) return NextResponse.next()

  // Content negotiation: Accept: text/markdown → rewrite to .md twin.
  // This is NOT cloaking — same URL, different format, driven by Accept header (not User-Agent).
  // See ADR 0013 and docs/features/seo-llm.md.
  if (req.headers.get('accept')?.includes('text/markdown')) {
    return NextResponse.rewrite(new URL(`${pathname}.md`, req.url))
  }

  // For HTML requests: add Link response header advertising the .md alternate.
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? req.nextUrl.origin
  const res = NextResponse.next()
  res.headers.set('Link', `<${base}${pathname}.md>; rel="alternate"; type="text/markdown"`)
  return res
}

export const config = {
  matcher: ['/product/:slug', '/category/:slug', '/policy/:slug'],
}
