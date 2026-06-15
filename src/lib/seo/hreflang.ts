import { DEFAULT_LOCALE } from '@/lib/constants'

/**
 * Builds per-locale absolute URL alternates for hreflang / sitemap use.
 *
 * URL scheme (confirmed from middleware.ts):
 *   - DEFAULT_LOCALE (en) → no prefix: baseUrl + path
 *   - other locales        → prefixed:   baseUrl + '/' + locale + path
 *
 * @param path           The path segment, e.g. '/product/abc' or '/'.
 * @param enabledLocales Subset of SHIPPED_LOCALES that the store has enabled.
 *                       Typed as string[] because the config schema infers
 *                       enabledLocales as string[]; runtime values are always a
 *                       validated subset of SHIPPED_LOCALES.
 * @param baseUrl        The site origin (e.g. 'https://example.com'). No trailing slash.
 * @returns languages    Record mapping locale code → absolute URL for that locale.
 * @returns xDefault     The canonical default-locale URL (used as x-default).
 */
export function buildLocaleAlternates(
  path: string,
  enabledLocales: readonly string[],
  baseUrl: string,
): { languages: Record<string, string>; xDefault: string } {
  // Normalize: ensure a leading '/'.
  // - Default locale keeps the path verbatim, so the root stays `${base}/` —
  //   matching the home page canonical (`${siteUrl}/`).
  // - Prefixed locales drop the root's trailing slash so `/fr/` becomes `/fr`
  //   (Next serves the locale-prefix root with no trailing slash).
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const prefixSuffix = normalizedPath === '/' ? '' : normalizedPath

  const xDefault = `${baseUrl}${normalizedPath}`

  const languages: Record<string, string> = {}
  for (const locale of enabledLocales) {
    if (locale === DEFAULT_LOCALE) {
      languages[locale] = `${baseUrl}${normalizedPath}`
    } else {
      languages[locale] = `${baseUrl}/${locale}${prefixSuffix}`
    }
  }

  // Always include x-default pointing to the default locale URL.
  languages['x-default'] = xDefault

  return { languages, xDefault }
}
