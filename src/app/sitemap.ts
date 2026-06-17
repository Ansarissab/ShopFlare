import type { MetadataRoute } from 'next'
import { POLICY_SLUGS, DEFAULT_LOCALE } from '@/lib/constants'
import type { LocaleCode } from '@/lib/constants'
import { buildLocaleAlternates } from '@/lib/seo/hreflang'
import { serverWorkerUrl } from '@/lib/server/worker-origin'
import { fetchFromWorker } from '@/lib/server/fetchFromWorker'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const workerUrl = serverWorkerUrl()
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? (workerUrl ? workerUrl.replace(/\/api$/, '') : '')

  // Fetch per-page updatedAt timestamps to populate lastModified on policy routes
  const policyUpdates: Record<string, string> = {}
  const pages = await fetchFromWorker<Array<{ slug: string; updatedAt?: string }>>('/api/pages', {
    revalidate: 3600,
  })
  if (pages) {
    for (const p of pages) {
      if (p.updatedAt) policyUpdates[p.slug] = p.updatedAt
    }
  }

  // When the landing page is enabled, `/` is the marketing page and `/shop` is the catalog.
  let landingEnabled = false
  let faqEnabled = false
  let enabledLocales: LocaleCode[] = [DEFAULT_LOCALE]
  const cfg = await fetchFromWorker<{
    landingEnabled?: boolean
    faqEnabled?: boolean
    faqItems?: unknown[]
    enabledLocales?: LocaleCode[]
  }>('/api/config/store', { revalidate: 3600 })
  if (cfg) {
    landingEnabled = cfg.landingEnabled ?? false
    faqEnabled = (cfg.faqEnabled ?? false) && (cfg.faqItems?.length ?? 0) > 0
    if (cfg.enabledLocales && cfg.enabledLocales.length > 0) {
      enabledLocales = cfg.enabledLocales
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
  // /api/products returns { products: ProductWithVariants[] }. Products have
  // no slug column — they're identified by id, and the /product/[slug] route
  // resolves by id (matching the IndexNow ping path).
  const productsData = await fetchFromWorker<{
    products?: Array<{ product: { id: string; updatedAt?: string } }>
  }>('/api/products', { revalidate: 3600 })
  if (productsData) {
    productRoutes = (productsData.products ?? []).map(({ product }) => ({
      url: `${siteUrl}/product/${product.id}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
      alternates: { languages: alternates(`/product/${product.id}`) },
      ...(product.updatedAt ? { lastModified: new Date(product.updatedAt) } : {}),
    }))
  }

  let categoryRoutes: MetadataRoute.Sitemap = []
  const categoriesData = await fetchFromWorker<{
    categories: Array<{ slug: string; children?: Array<{ slug: string }> }>
  }>('/api/categories', { revalidate: 3600 })
  if (categoriesData) {
    const allSlugs: string[] = []
    for (const cat of categoriesData.categories) {
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

  let blogRoutes: MetadataRoute.Sitemap = []
  const blogData = await fetchFromWorker<{ posts: Array<{ slug: string; publishedAt?: string }> }>(
    '/api/blog',
    { revalidate: 3600 },
  )
  if (blogData) {
    blogRoutes = [
      {
        url: `${siteUrl}/blog`,
        changeFrequency: 'weekly' as const,
        priority: 0.7,
        alternates: { languages: alternates('/blog') },
      },
      ...blogData.posts.map((p) => ({
        url: `${siteUrl}/blog/${p.slug}`,
        changeFrequency: 'weekly' as const,
        priority: 0.5,
        alternates: { languages: alternates(`/blog/${p.slug}`) },
        ...(p.publishedAt ? { lastModified: new Date(p.publishedAt) } : {}),
      })),
    ]
  }
  return [...staticRoutes, ...productRoutes, ...categoryRoutes, ...blogRoutes]
}
