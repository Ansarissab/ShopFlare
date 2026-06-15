import type { MetadataRoute } from 'next'
import { POLICY_SLUGS, DEFAULT_LOCALE } from '@/lib/constants'
import type { LocaleCode } from '@/lib/constants'
import { buildLocaleAlternates } from '@/lib/seo/hreflang'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL ?? ''
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? (workerUrl ? workerUrl.replace(/\/api$/, '') : '')

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
  let faqEnabled = false
  let enabledLocales: LocaleCode[] = [DEFAULT_LOCALE]
  if (workerUrl) {
    try {
      const cfgRes = await fetch(`${workerUrl}/api/config/store`, { next: { revalidate: 3600 } })
      if (cfgRes.ok) {
        const cfg = (await cfgRes.json()) as {
          landingEnabled?: boolean
          faqEnabled?: boolean
          faqItems?: unknown[]
          enabledLocales?: LocaleCode[]
        }
        landingEnabled = cfg.landingEnabled ?? false
        faqEnabled = (cfg.faqEnabled ?? false) && (cfg.faqItems?.length ?? 0) > 0
        if (cfg.enabledLocales && cfg.enabledLocales.length > 0) {
          enabledLocales = cfg.enabledLocales
        }
      }
    } catch {
      // skip — landingEnabled/faqEnabled stay false, /shop and /faq won't be included
    }
  }

  // Helper: build the alternates object for a given path.
  const alternates = (path: string) =>
    buildLocaleAlternates(path, enabledLocales, siteUrl).languages

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: siteUrl || '/',
      changeFrequency: 'daily',
      priority: 1,
      alternates: { languages: alternates('/') },
    },
    ...(landingEnabled
      ? [
          {
            url: `${siteUrl}/shop`,
            changeFrequency: 'daily' as const,
            priority: 0.9,
            alternates: { languages: alternates('/shop') },
          },
        ]
      : []),
    ...(faqEnabled
      ? [
          {
            url: `${siteUrl}/faq`,
            changeFrequency: 'weekly' as const,
            priority: 0.5,
            alternates: { languages: alternates('/faq') },
          },
        ]
      : []),
    ...POLICY_SLUGS.map((slug) => ({
      url: `${siteUrl}/policy/${slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.3,
      alternates: { languages: alternates(`/policy/${slug}`) },
      ...(policyUpdates[slug] ? { lastModified: new Date(policyUpdates[slug]) } : {}),
    })),
  ]

  let productRoutes: MetadataRoute.Sitemap = []
  if (workerUrl) {
    try {
      const res = await fetch(`${workerUrl}/api/products`, { next: { revalidate: 3600 } })
      if (res.ok) {
        const products = (await res.json()) as Array<{
          slug?: string
          id: string
          updatedAt?: string
        }>
        productRoutes = products
          .filter((p) => p.slug)
          .map((p) => ({
            url: `${siteUrl}/product/${p.slug}`,
            changeFrequency: 'weekly' as const,
            priority: 0.8,
            alternates: { languages: alternates(`/product/${p.slug}`) },
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
        const data = (await res.json()) as {
          categories: Array<{ slug: string; children?: Array<{ slug: string }> }>
        }
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
          alternates: { languages: alternates(`/category/${slug}`) },
        }))
      }
    } catch {
      // worker unavailable at build time — category routes skipped
    }
  }

  let blogRoutes: MetadataRoute.Sitemap = []
  if (workerUrl) {
    try {
      const res = await fetch(`${workerUrl}/api/blog`, { next: { revalidate: 3600 } })
      if (res.ok) {
        const data = (await res.json()) as { posts: Array<{ slug: string; publishedAt?: string }> }
        blogRoutes = [
          {
            url: `${siteUrl}/blog`,
            changeFrequency: 'weekly' as const,
            priority: 0.7,
            alternates: { languages: alternates('/blog') },
          },
          ...data.posts.map((p) => ({
            url: `${siteUrl}/blog/${p.slug}`,
            changeFrequency: 'weekly' as const,
            priority: 0.5,
            alternates: { languages: alternates(`/blog/${p.slug}`) },
            ...(p.publishedAt ? { lastModified: new Date(p.publishedAt) } : {}),
          })),
        ]
      }
    } catch {
      // worker unavailable at build time — blog routes skipped
    }
  }
  return [...staticRoutes, ...productRoutes, ...categoryRoutes, ...blogRoutes]
}
