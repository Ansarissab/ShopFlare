import type { MetadataRoute } from 'next'
import { POLICY_SLUGS } from '@/lib/constants'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL ?? ''
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    ?? (workerUrl ? workerUrl.replace(/\/api$/, '') : '')

  // Fetch per-page updatedAt timestamps to populate lastModified on policy routes
  const policyUpdates: Record<string, string> = {}
  if (workerUrl) {
    try {
      const pagesRes = await fetch(`${workerUrl}/api/pages`, { next: { revalidate: 3600 } })
      if (pagesRes.ok) {
        const pages = (await pagesRes.json()) as Array<{ slug: string; updatedAt?: string }>
        for (const p of pages) {
          if (p.updatedAt) policyUpdates[p.slug] = p.updatedAt
        }
      }
    } catch {
      // skip — policy routes will have no lastModified
    }
  }

  // When the landing page is enabled, `/` is the marketing page and `/shop` is the catalog.
  let landingEnabled = false
  if (workerUrl) {
    try {
      const cfgRes = await fetch(`${workerUrl}/api/config/store`, { next: { revalidate: 3600 } })
      if (cfgRes.ok) {
        const cfg = (await cfgRes.json()) as { landingEnabled?: boolean }
        landingEnabled = cfg.landingEnabled ?? false
      }
    } catch {
      // skip — landingEnabled stays false, /shop won't be included
    }
  }

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: siteUrl || '/', changeFrequency: 'daily', priority: 1 },
    ...(landingEnabled ? [{ url: `${siteUrl}/shop`, changeFrequency: 'daily' as const, priority: 0.9 }] : []),
    ...POLICY_SLUGS.map((slug) => ({
      url: `${siteUrl}/policy/${slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.3,
      ...(policyUpdates[slug] ? { lastModified: new Date(policyUpdates[slug]) } : {}),
    })),
  ]

  let productRoutes: MetadataRoute.Sitemap = []
  if (workerUrl) {
    try {
      const res = await fetch(`${workerUrl}/api/products`, { next: { revalidate: 3600 } })
      if (res.ok) {
        const products = (await res.json()) as Array<{ slug?: string; id: string; updatedAt?: string }>
        productRoutes = products
          .filter((p) => p.slug)
          .map((p) => ({
            url: `${siteUrl}/product/${p.slug}`,
            changeFrequency: 'weekly' as const,
            priority: 0.8,
            ...(p.updatedAt ? { lastModified: new Date(p.updatedAt) } : {}),
          }))
      }
    } catch {
      // worker unavailable at build time — only static routes included
    }
  }

  let categoryRoutes: MetadataRoute.Sitemap = []
  if (workerUrl) {
    try {
      const res = await fetch(`${workerUrl}/api/categories`, { next: { revalidate: 3600 } })
      if (res.ok) {
        const data = (await res.json()) as { categories: Array<{ slug: string; children?: Array<{ slug: string }> }> }
        const allSlugs: string[] = []
        for (const cat of data.categories) {
          allSlugs.push(cat.slug)
          for (const child of cat.children ?? []) {
            allSlugs.push(child.slug)
          }
        }
        categoryRoutes = allSlugs.map((slug) => ({
          url: `${siteUrl}/category/${slug}`,
          changeFrequency: 'weekly' as const,
          priority: 0.6,
        }))
      }
    } catch {
      // worker unavailable at build time — category routes skipped
    }
  }

  // TODO: blog routes — add here when phase-23 ships
  return [...staticRoutes, ...productRoutes, ...categoryRoutes]
}
