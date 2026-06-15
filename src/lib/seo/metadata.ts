import type { Metadata } from 'next'
import { buildLocaleAlternates } from '@/lib/seo/hreflang'

export interface PageMetadataInput {
  title: string
  description?: string
  /** Absolute canonical URL */
  canonical?: string
  imageUrl?: string
  storeName?: string
  /** Absolute URL to the .md version of this page (advertised via rel=alternate). */
  mdUrl?: string
  /**
   * When provided, injects hreflang alternates into the metadata.
   * `path` is the page path (e.g. '/product/abc'), `baseUrl` is the site origin.
   * Backward-compatible: omitting this field leaves existing behavior unchanged.
   */
  localeAlternates?: {
    path: string
    enabledLocales: readonly string[]
    baseUrl: string
  }
}

// Builds consistent Next.js Metadata from a page's entity data.
// Uses the root layout title template (%s — StoreName) when storeName is provided.
export function buildPageMetadata(input: PageMetadataInput): Metadata {
  const { title, description, canonical, imageUrl, storeName, mdUrl, localeAlternates } = input

  const hreflangLanguages =
    localeAlternates && localeAlternates.enabledLocales.length > 0
      ? buildLocaleAlternates(
          localeAlternates.path,
          localeAlternates.enabledLocales,
          localeAlternates.baseUrl,
        ).languages
      : undefined

  return {
    title,
    ...(description ? { description } : {}),
    ...(canonical || mdUrl || hreflangLanguages
      ? {
          alternates: {
            ...(canonical ? { canonical } : {}),
            ...(mdUrl ? { types: { 'text/markdown': mdUrl } } : {}),
            ...(hreflangLanguages ? { languages: hreflangLanguages } : {}),
          },
        }
      : {}),
    openGraph: {
      title,
      ...(description ? { description } : {}),
      ...(imageUrl ? { images: [{ url: imageUrl }] } : {}),
      ...(canonical ? { url: canonical } : {}),
      ...(storeName ? { siteName: storeName } : {}),
      type: 'website',
    },
    twitter: {
      card: imageUrl ? 'summary_large_image' : 'summary',
      title,
      ...(description ? { description } : {}),
      ...(imageUrl ? { images: [imageUrl] } : {}),
    },
  }
}
