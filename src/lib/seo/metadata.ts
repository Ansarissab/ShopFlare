import type { Metadata } from 'next'

export interface PageMetadataInput {
  title: string
  description?: string
  /** Absolute canonical URL */
  canonical?: string
  imageUrl?: string
  storeName?: string
  /** Absolute URL to the .md version of this page (advertised via rel=alternate). */
  mdUrl?: string
}

// Builds consistent Next.js Metadata from a page's entity data.
// Uses the root layout title template (%s — StoreName) when storeName is provided.
export function buildPageMetadata(input: PageMetadataInput): Metadata {
  const { title, description, canonical, imageUrl, storeName, mdUrl } = input

  return {
    title,
    ...(description ? { description } : {}),
    ...(canonical || mdUrl
      ? {
          alternates: {
            ...(canonical ? { canonical } : {}),
            ...(mdUrl ? { types: { 'text/markdown': mdUrl } } : {}),
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
