import { headers } from 'next/headers'

/**
 * Resolves the absolute site origin in priority order:
 * 1. NEXT_PUBLIC_SITE_URL env var (set at build time / runtime).
 * 2. Incoming request headers — `x-forwarded-proto` + `x-forwarded-host` (or `host`).
 * 3. Empty string (last resort — callers must guard against it).
 *
 * Single source of truth for the base URL used in canonical, hreflang,
 * and sitemap. Replaces the scattered `process.env.NEXT_PUBLIC_SITE_URL ?? ''`
 * fallbacks in page.tsx / layout.tsx / sitemap.ts.
 */
export async function resolveSiteUrl(): Promise<string> {
  const envUrl = process.env.NEXT_PUBLIC_SITE_URL
  if (envUrl) return envUrl.replace(/\/$/, '')

  try {
    const hdrs = await headers()
    const host = hdrs.get('x-forwarded-host') ?? hdrs.get('host')
    const proto = hdrs.get('x-forwarded-proto') ?? 'https'
    if (host) return `${proto}://${host}`
  } catch {
    // headers() throws outside a request context (e.g. during static prerender).
  }

  return ''
}
